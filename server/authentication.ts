import { Express } from 'express';
import { Issuer, Strategy, TokenSet, UserinfoResponse } from 'openid-client';
import passport from 'passport';
import session from 'express-session';

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
	logoutUrl?: string;
}

export async function getAuthStrategy({
	server,
	clientId,
	clientSecret,
	usePKCE = false,
	callbackUrl,
	logoutUrl,
}: AuthStrategyOptions) {
	const authIssuer = await Issuer.discover(server);
	const authClient = new authIssuer.Client({
		client_id: clientId,
		client_secret: clientSecret,
		redirect_uris: [callbackUrl],
		post_logout_redirect_uris: logoutUrl ? [logoutUrl] : undefined,
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

	return {
		authStrategy: new Strategy(strategyOptions, verifier),
		authClient,
	};
}

interface AuthSetupOptions {
	server: string;
	clientId: string;
	clientSecret?: string;
	usePKCE?: boolean;
	hostingUrl: string;
}

export async function setupExpressAuth(
	app: Express,
	{ server, clientId, clientSecret, usePKCE, hostingUrl }: AuthSetupOptions,
) {
	app.use(
		session({
			secret: 'iowjefowiejf',
			resave: false,
			saveUninitialized: true,
		}),
	);
	app.use(passport.initialize());
	app.use(passport.session());

	const { authStrategy, authClient } = await getAuthStrategy({
		server,
		clientId,
		clientSecret,
		usePKCE,
		callbackUrl: `${hostingUrl}/oidc-callback`,
		logoutUrl: hostingUrl,
	});
	passport.use('oidc', authStrategy);

	passport.serializeUser((user, done) => {
		done(null, user);
	});

	passport.deserializeUser((userId, done) => {
		done(null, userId);
	});

	app.get('/login', passport.authenticate('oidc'));
	app.get('/logout', (req, res) => {
		req.logout();
		req.session!.destroy(() => {});
		res.redirect(
			authClient.endSessionUrl({ post_logout_redirect_uri: hostingUrl }),
		);
	});

	app.use(
		'/oidc-callback',
		passport.authenticate('oidc', { failureRedirect: '/error' }),
		(req, res) => {
			res.redirect('/');
		},
	);
}

declare global {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace Express {
		interface User {
			id: string;
			name: string;
			email: string;
		}
	}
}
