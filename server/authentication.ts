import { Express } from 'express';
import {
	Issuer,
	Strategy,
	TokenSet,
	UserinfoResponse,
	custom,
	StrategyOptions,
	Client,
} from 'openid-client';
import passport from 'passport';
import session from 'express-session';
import { getRepository } from 'typeorm';
import url from 'url';
import createMemoryStore from 'memorystore';
import { shouldSendSameSiteNone } from 'should-send-same-site-none';
import rateLimit from 'express-rate-limit';

import { User, User as AppUser } from './entities/user';
import { Site } from './entities/site';

const MemoryStore = createMemoryStore(session);

interface AuthStrategyOptions {
	server: string;
	clientId: string;
	clientSecret?: string;
	callbackUrl: string;
	usePKCE?: boolean;
	logoutUrl?: string;
	adminSub?: string;
}

export async function getAuthStrategy({
	server,
	clientId,
	clientSecret,
	usePKCE = false,
	callbackUrl,
	logoutUrl,
	adminSub,
}: AuthStrategyOptions): Promise<{
	authStrategy: Strategy<User, Client>;
	authClient: Client;
}> {
	Issuer[custom.http_options] = (options) => ({ ...options, timeout: 10000 });
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
	authClient[custom.clock_tolerance] = 1;

	const strategyOptions: StrategyOptions<Client> = {
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
		// eslint-disable-next-line @typescript-eslint/no-floating-promises
		(async () => {
			if (!profile.email_verified) {
				return done(
					new Error(
						"OIDC: the user's email address is not verified.",
					),
				);
			}

			const existingUser = await getRepository(User).findOne({
				where: { email: profile.email },
				select: ['id', 'isAdmin'],
			});

			if (existingUser && existingUser.id !== profile.sub) {
				return done(
					new Error(
						"OIDC: the user's email address is already in use.",
					),
				);
			}

			const user = {
				id: profile.sub,
				name: profile.name,
				email: profile.email,
				profileImage: profile.picture || '',
				isAdmin:
					existingUser?.isAdmin ||
					(adminSub && profile.sub === adminSub) ||
					false,
			} as User;

			getRepository(User)
				.save(user)
				// eslint-disable-next-line no-console
				.catch(() => console.error(`Couldn't save user ${user.id}`));

			return done(null, user);
		})();
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
	adminSub?: string;
	useProxy?: boolean;
	sessionSecret?: string;
}

export async function setupExpressAuth(
	app: Express,
	{
		server,
		clientId,
		clientSecret,
		usePKCE,
		hostingUrl,
		adminSub,
		useProxy,
		sessionSecret = 'iowjefowiejf',
	}: AuthSetupOptions,
): Promise<void> {
	const apiLimiter = rateLimit({
		windowMs: 15 * 60 * 1000,
		max: 100,
	});

	app.use(shouldSendSameSiteNone);
	app.use(
		session({
			secret: sessionSecret,
			resave: false,
			saveUninitialized: true,
			rolling: true,
			proxy: useProxy,
			cookie: {
				maxAge: 30 * 60 * 1000,
				sameSite: 'none',
				httpOnly: true,
				secure: 'auto',
			},
			store: new MemoryStore({ checkPeriod: 3600 * 1000 }),
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
		adminSub,
	});
	passport.use('oidc', authStrategy);

	passport.serializeUser<string>((user, done) => {
		return done(null, user.id);
	});

	passport.deserializeUser<string>((userId, done) => {
		getRepository(User)
			.findOneOrFail(userId)
			.then(
				(user) => done(null, user),
				(error) => done(error),
			);
	});

	app.get('/login', apiLimiter, (req, res) =>
		passport.authenticate('oidc', {
			state: req.query.redirectUrl as string,
		})(req, res),
	);
	app.get('/logout', (req, res) => {
		req.logout();
		req.session.destroy(() => {});
		res.redirect(
			authClient.endSessionUrl({ post_logout_redirect_uri: hostingUrl }),
		);
	});

	app.use(
		'/oidc-callback',
		apiLimiter,
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		passport.authenticate('oidc', {
			failureRedirect: '/error',
		}),
		async (req, res) => {
			let redirectUrl: string = (req.query.state as string) || '/';
			const isExternalUrl =
				redirectUrl &&
				(!redirectUrl.startsWith('/') || redirectUrl.startsWith('//'));
			if (isExternalUrl) {
				const parsedUrl = url.parse(redirectUrl);
				const site = await getRepository(Site).findOne({
					where: { domain: parsedUrl.host },
					relations: ['editors'],
				});
				if (
					!req.user ||
					!site ||
					!site.editors?.find((user) => user.id === req.user!.id)
				) {
					redirectUrl = '/';
				}
			}
			res.redirect(redirectUrl);
		},
	);
}

declare global {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace Express {
		// eslint-disable-next-line @typescript-eslint/no-empty-interface
		interface User extends AppUser {}
	}
}
