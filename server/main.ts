import express, { Request, Response } from 'express';
import session from 'express-session';
import passport from 'passport';
import { Arguments, getArguments } from './arguments';
import { Profile, getAuthStrategy } from './authentication';

async function Main({
	port,
	hostingUrl,
	authServer,
	authClientId,
	authClientSecret,
	authPkce,
}: Arguments) {
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
	passport.use(
		'oidc',
		await getAuthStrategy({
			server: authServer,
			clientId: authClientId,
			clientSecret: authClientSecret,
			usePKCE: authPkce,
			callbackUrl: `${hostingUrl}/oidc-callback`,
		}),
	);

	passport.serializeUser<Profile, string>((user, done) => {
		done(null, user.id);
	});

	passport.deserializeUser<Profile, string>((userId, done) => {
		done(null, { id: userId, email: '', name: '' });
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
