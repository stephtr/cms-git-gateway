import { Issuer, Strategy, TokenSet, UserinfoResponse } from 'openid-client';

export interface Profile {
	id: string;
	name: string;
	email: string;
}

interface AuthStrategyOptions {
	server: string;
	clientId: string;
	clientSecret?: string;
	callbackUrl: string;
	usePKCE?: boolean;
}

export async function getAuthStrategy({
	server,
	clientId,
	clientSecret,
	usePKCE = false,
	callbackUrl,
}: AuthStrategyOptions) {
	const authIssuer = await Issuer.discover(server);
	const authClient = new authIssuer.Client({
		client_id: clientId,
		client_secret: clientSecret,
		redirect_uris: [callbackUrl],
		response_types: ['code'],
		token_endpoint_auth_method: clientSecret
			? 'client_secret_basic'
			: 'none',
	});

	const strategyOptions = {
		client: authClient,
		usePKCE,
		params: {
			redirect_uri: callbackUrl,
			scope: 'openid profile email',
			response_type: 'code',
		},
	};
	const verifier = (
		tokenSet: TokenSet,
		profile: UserinfoResponse,
		done: (error?: Error | null, user?: any) => void,
	) => {
		if (!profile.email_verified) {
			done(new Error("OIDC: the user's email address is not verified."));
		}
		done(null, {
			id: profile.sub,
			name: profile.name,
			email: profile.email,
		} as Profile);
	};

	return new Strategy(strategyOptions, verifier);
}
