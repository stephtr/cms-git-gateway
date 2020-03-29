import yargs from 'yargs';

const defaultLocalhostUrl = 'http://localhost';

export interface Arguments {
	port: number;
	hostingUrl: string;
	authServer: string;
	authClientId: string;
	authClientSecret: string;
	authPkce: boolean;
}

export function getArguments(): Arguments {
	const { argv } = yargs.options({
		port: {
			type: 'number',
			default: 3000,
			description: 'Port this server listens on',
		},
		hostingUrl: {
			type: 'string',
			default: defaultLocalhostUrl,
			description: 'Public url of this server',
		},
		authServer: {
			type: 'string',
			required: true,
			description: 'Url of the Auth server',
		},
		authClientId: {
			type: 'string',
			default: 'netlify-gateway-server',
			description: 'client_id for accessing the Auth server',
		},
		authClientSecret: {
			type: 'string',
			description: 'client_secret for accessing the Auth server',
		},
		authPkce: {
			type: 'boolean',
			description: 'Whether PKCE should be used for authentication',
		},
	});

	if (argv.hostingUrl === defaultLocalhostUrl) {
		argv.hostingUrl += `:${argv.port}`;
	}
	return argv as Arguments;
}
