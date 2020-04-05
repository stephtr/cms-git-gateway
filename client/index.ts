import yaml from 'js-yaml';

declare global {
	interface Window {
		CMS_CONFIG: any;
		netlifyIdentity: any;
	}
}

// wrap the fetch api such that we can inject credentials (cookie authentication)
const nativeFetch = window.fetch;
window.fetch = (resource: RequestInfo, init?: any) => {
	if (
		init &&
		init.headers &&
		init.headers.Authorization === 'Bearer USE_COOKIE_INSTEAD'
	) {
		delete init.headers.Authorization;
		init.credentials = 'include';
	}
	return nativeFetch(resource, init);
};

type CallbackType = 'login' | 'logout' | 'error';

const callbacks: { [index: string]: Array<(arg?: any) => void> } = {
	login: [],
	logout: [],
	error: [],
};

function dispatch(event: CallbackType, argument: any) {
	callbacks[event].forEach((cb) => cb(argument));
}

let user: {} | undefined;

async function getConfig(configLocation?: string) {
	const configResponse = await fetch(configLocation || 'config.yml');
	const yamlString = await configResponse.text();
	return yaml.load(yamlString);
}

async function getUser(gatewayUrl: string) {
	const userResponse = await fetch(`${gatewayUrl}/user`, {
		credentials: 'include',
	});
	if (!userResponse.ok) {
		return undefined;
	}
	const fetchedUser = await userResponse.json();
	return {
		app_metadata: { provider: 'netlify-git-gateway' },
		aud: '',
		confirmed_at: '',
		created_at: '',
		updated_at: '',
		email: fetchedUser.email,
		id: fetchedUser.email,
		role: '',
		url: '',
		user_metadata: {
			avatar_url: fetchedUser.profileImage,
			full_name: fetchedUser.name,
		},
		jwt: () => Promise.resolve('USE_COOKIE_INSTEAD'),
	};
}

window.netlifyIdentity = {
	on: (event: CallbackType, cb: () => void) => callbacks[event].push(cb),
	open: () => {},
	init: () => {},
	close: () => {},
	logout: () => {},
	currentUser: () => user,
};

async function initialize() {
	const config = await getConfig();
	const gatewayUrl = config.backend.gateway_url;

	window.netlifyIdentity.logout = () => {
		window.location.href = `${gatewayUrl}/logout`;
	};

	user = await getUser(gatewayUrl);

	if (user) {
		dispatch('login', user);
	} else {
		window.location.href = `${gatewayUrl}/login?redirectUrl=${window.location}`;
	}
}

initialize();

export default undefined;
