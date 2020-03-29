import express, { Request, Response } from 'express';
import session from 'express-session';
import passport from 'passport';
import OAuth2Strategy from 'passport-oauth2';
import { Arguments, getArguments } from './arguments';
import {
	getAuthSettings,
	Profile,
	userProfileProvider,
	VerifiedProfile,
} from './authentication';

async function Main({
	port,
	hostingUrl,
	authServer,
	authClientId,
	authClientSecret,
	authPkce,
}: Arguments) {
	const authSettings = await getAuthSettings(authServer);
	const authStrategy = new OAuth2Strategy(
		{
			...authSettings,
			clientID: authClientId,
			clientSecret: authClientSecret,
			callbackURL: `${hostingUrl}/oidc-callback`,
			pkce: authPkce,
			state: authPkce,
			scope: 'openid profile email',
		} as any,
		(accessToken, refreshToken, params, profile: VerifiedProfile, done) => {
			if (!profile.emailVerified) {
				done(null, undefined, {
					message: "OIDC: the user' email address is not verified.",
				});
			}
			done(null, profile);
		},
	);
	// eslint-disable-next-line @typescript-eslint/unbound-method
	authStrategy.userProfile = userProfileProvider(authSettings.userInfoURL);

	const app = express();
	app.use(
		session({
			secret: 'iowjefowiejf',
			resave: false,
			saveUninitialized: true,
		}),
	);
	app.use(passport.initialize());
	app.use(passport.session());
	passport.use('oidc', authStrategy);

	passport.serializeUser<Profile, string>((user, done) => {
		done(null, user.id);
	});

	passport.deserializeUser<Profile, string>((userId, done) => {
		done(null, obj);
	});

	app.get('/', (req, res) => res.send('<a href="/profile">Profile</a>'));

	app.use('/login', passport.authenticate('oidc'));
	app.get('/logout', (req, res) => {
		req.logout();
		req.session!.destroy(() => {});
		res.redirect('/');
	});

	app.use(
		'/oidc-callback',
		passport.authenticate('oidc', { failureRedirect: '/error' }),
		(req, res) => {
			res.redirect('/');
		},
	);

	function ensureLoggedIn(req: Request, res: Response, next: () => void) {
		if (req.isAuthenticated()) {
			return next();
		}

		res.redirect('/login');
	}

	app.use('/profile', ensureLoggedIn, (req, res) => res.send(req.user));

	app.use('/error', (req, res) => res.status(500).send('An error occured.'));

	app.listen(port, () =>
		// eslint-disable-next-line no-console
		console.log(`Server listening on http://localhost:${port}`),
	);
}

Main(getArguments());
