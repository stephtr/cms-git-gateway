import { Express, Request, Response } from 'express';
import { getRepository } from 'typeorm';
import { User } from './entities/user';
import { Site } from './entities/site';

function ensureLoggedIn(req: Request, res: Response, next: () => void) {
	if (req.isAuthenticated()) {
		return next();
	}

	res.redirect('/login');
}

const ensureIsAdmin = (req: Request, res: Response, next: () => void) =>
	ensureLoggedIn(req, res, () => {
		if (req.user?.isAdmin) {
			return next();
		}

		res.redirect('/error');
	});

export default function addAppRoutes(app: Express) {
	app.set('view engine', 'ejs');

	app.use('/error', (req, res) =>
		res.status(500).render('pages/error.ejs', { user: req.user }),
	);

	app.get('/', (req, res) => {
		res.render(`pages/index${req.user ? '.logged-in' : ''}.ejs`, {
			user: req.user,
		});
	});

	app.get('/admin/access', ensureIsAdmin, async (req, res) =>
		res.render('pages/sites.ejs', {
			user: req.user,
			sites: await getRepository(Site).find({
				select: ['domain', 'proxyType', 'url'],
				order: { domain: 'ASC' },
			}),
		}),
	);

	app.post('/admin/users', ensureIsAdmin, async (req, res) => {
		const userRepo = getRepository(User);
		if (req.body.userId !== req.user!.id) {
			const user = await userRepo.findOne(req.body.userId);
			if (user) {
				if (req.body.action_promote !== undefined) {
					user.isAdmin = true;
					userRepo.save(user);
				}
				if (req.body.action_revoke !== undefined) {
					user.isAdmin = false;
					userRepo.save(user);
				}
				if (req.body.action_remove !== undefined) {
					userRepo.delete(user);
				}
			}
		}
		res.redirect('/admin/users');
	});

	app.get('/admin/users', ensureIsAdmin, async (req, res) =>
		res.render('pages/users.ejs', {
			user: req.user,
			users: (
				await getRepository(User).find({
					select: ['id', 'name', 'email', 'isAdmin'],
					order: { id: 'DESC' },
				})
			).sort(
				// sort the list such that the current user will be on top
				(a, b) => +(b.id === req.user!.id) - +(a.id === req.user!.id),
			),
		}),
	);
}
