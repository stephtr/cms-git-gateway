import { Express, Request, Response } from 'express';

function ensureLoggedIn(req: Request, res: Response, next: () => void) {
	if (req.isAuthenticated()) {
		return next();
	}

	res.redirect('/login');
}

export default function addAppRoutes(app: Express) {
	app.set('view engine', 'ejs');

	app.use('/error', (req, res) => res.status(500).send('An error occured.'));

	app.get('/', (req, res) => {
		if (req.user) {
			res.render('pages/index.logged-in.ejs', {
				userName: req.user.name,
			});
		} else {
			res.render('pages/index.ejs');
		}
	});

	app.use('/profile', ensureLoggedIn, (req, res) => res.send(req.user));
}
