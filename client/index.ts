import { parse as parseYaml } from 'yaml';

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

function dispatch(event: CallbackType, argument?: any) {
	callbacks[event].forEach((cb) => cb(argument));
}

let gatewayUrl: string | undefined;
let user: {} | undefined;
const backgroundUpdateInterval = 60 * 1000;

async function getConfig(configLocation?: string) {
	const configResponse = await fetch(configLocation || 'config.yml');
	const yamlString = await configResponse.text();
	return parseYaml(yamlString);
}

async function getUser() {
	if (!gatewayUrl) {
		throw Error('gatewayUrl is not set');
	}
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
	logout: () => {
		if (gatewayUrl) {
			window.location.href = `${gatewayUrl}/logout`;
		}
	},
	currentUser: () => user,
};

async function backgroundUpdate() {
	const newUser = await getUser();
	if (!user && newUser) {
		dispatch('login', newUser);
	}
	if (user && !newUser) {
		dispatch('logout');
		window.open(`${gatewayUrl}/login?redirectUrl=${window.location}`);
	}
	user = newUser;
	// eslint-disable-next-line @typescript-eslint/no-misused-promises
	setTimeout(backgroundUpdate, backgroundUpdateInterval);
}

async function initialize() {
	try {
		const config = window.CMS_CONFIG || (await getConfig());

		if (config.local_backend) {
			// local operation, therefore no authentication necessary
			return;
		}

		if (window.localStorage) {
			// remove cached login information since we do authentication by ourselves
			window.localStorage.removeItem('netlify-cms-user');
		}

		gatewayUrl = config.backend.gateway_url;
		user = await getUser();

		if (user) {
			dispatch('login', user);
		} else {
			window.location.href = `${gatewayUrl}/login?redirectUrl=${window.location}`;
		}

		// eslint-disable-next-line @typescript-eslint/no-misused-promises
		setTimeout(backgroundUpdate, backgroundUpdateInterval);
	} catch (error) {
		dispatch('error', error);
	}
}

initialize();

export default undefined;
