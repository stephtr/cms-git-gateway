import { Express, Request, Response } from 'express';
import { getRepository, Repository, createQueryBuilder } from 'typeorm';
import csrf from 'csurf';
import { createProxyMiddleware } from 'http-proxy-middleware';
import url from 'url';
import { User } from './entities/user';
import { Site, ProxyTypes } from './entities/site';

async function openCors(req: Request, res: Response, next: () => void) {
	const origin = req.get('origin');
	if (!origin) {
		return next();
	}
	const parsedOrigin = url.parse(origin);
	(req as any).site = await getRepository(Site).findOne({
		domain: parsedOrigin.host!,
	});
	if (!(req as any).site) {
		return next();
	}
	res.header('Access-Control-Allow-Origin', origin);
	res.header(
		'Access-Control-Allow-Headers',
		'Origin, X-Requested-With, Content-Type, Accept',
	);
	res.header('Access-Control-Allow-Credentials', 'true');
	if (req.method === 'OPTIONS') {
		res.sendStatus(204);
	} else {
		next();
	}
}

function ensureLoggedIn(req: Request, res: Response, next: () => void) {
	if (req.isAuthenticated()) {
		return next();
	}

	return res.redirect(`/login?redirectUrl=${req.path}`);
}

const ensureIsAdmin = (req: Request, res: Response, next: () => void) =>
	ensureLoggedIn(req, res, () => {
		if (req.user?.isAdmin) {
			return next();
		}

		return res.redirect('/error');
	});

const getUsers = async (repository: Repository<User>, currentUser: User) =>
	(
		await repository.find({
			select: ['id', 'name', 'email', 'isAdmin'],
			order: { id: 'DESC' },
		})
	).sort(
		// sort the list such that the current user will be on top
		(a, b) => +(b.id === currentUser.id) - +(a.id === currentUser.id),
	);

export default function addAppRoutes(app: Express) {
	const csrfProtection = csrf();
	app.set('view engine', 'ejs');

	app.use('/error', (req, res) =>
		res.status(500).render('pages/error.ejs', { user: req.user }),
	);

	app.get('/', async (req, res) => {
		if (req.user) {
			req.user = await getRepository(User).findOne(req.user.id, {
				relations: ['sites'],
			});
		}
		res.render(`pages/index${req.user ? '.logged-in' : ''}.ejs`, {
			user: req.user,
		});
	});

	app.post(
		'/admin/access',
		ensureIsAdmin,
		csrfProtection,
		async (req, res) => {
			const siteRepo = getRepository(Site);
			const site = await siteRepo.findOne(req.body.id);
			if (site) {
				if (req.body.action_remove !== undefined) {
					await siteRepo.delete(site);
				}
				if (req.body.action_edit !== undefined) {
					return res.render('pages/sites-edit.ejs', {
						user: req.user,
						csrfToken: req.csrfToken(),
						proxyTypes: Object.values(ProxyTypes),
						errors: [],
						id: site.id,
						data: { ...site, accessToken: '' },
						mode: 'edit',
					});
				}
				if (req.body.action_clone !== undefined) {
					return res.render('pages/sites-edit.ejs', {
						user: req.user,
						csrfToken: req.csrfToken(),
						proxyTypes: Object.values(ProxyTypes),
						errors: [],
						id: site.id,
						data: {},
						mode: 'clone',
					});
				}
				if (req.body.action_add_user !== undefined) {
					const user = await getRepository(User).findOne({
						where: { email: req.body.user },
					});
					if (user) {
						try {
							await createQueryBuilder()
								.relation(Site, 'editors')
								.of(site)
								.add(user);
						} catch {
							// user probably already exists in `editors`
						}
					}
				}
				if (req.body.action_revoke !== undefined) {
					const user = await getRepository(User).findOne(
						req.body.user,
					);
					if (user) {
						await createQueryBuilder()
							.relation(Site, 'editors')
							.of(site)
							.remove(user);
					}
				}
			}
			return res.redirect('/admin/access');
		},
	);

	app.get('/admin/access', ensureIsAdmin, csrfProtection, async (req, res) =>
		res.render('pages/sites.ejs', {
			user: req.user,
			sites: await getRepository(Site).find({
				select: ['id', 'domain', 'proxyType', 'repository'],
				order: { domain: 'ASC' },
				relations: ['editors'],
			}),
			users: await getUsers(getRepository(User), req.user!),
			csrfToken: req.csrfToken(),
		}),
	);

	app.post(
		'/admin/edit-website',
		ensureIsAdmin,
		csrfProtection,
		async (req, res) => {
			const errors: string[] = [];
			const data: Omit<Site, 'id'> = {
				domain: req.body.domain,
				proxyType: req.body.proxyType,
				repository: req.body.repository,
				accessToken: req.body.accessToken,
			};
			const parsedData: Omit<Site, 'id'> = { ...data };
			const siteRepo = getRepository(Site);

			const domainResult = /^(https?:\/\/)?([^/]+)\/?$/.exec(data.domain);
			if (domainResult) {
				parsedData.domain = (
					domainResult?.[2] || ''
				).toLocaleLowerCase();
				const foundSite = await siteRepo.findOne({
					where: { domain: parsedData.domain },
					select: ['id'],
				});

				if (foundSite && foundSite.id !== +req.body.id) {
					errors.push('domain');
				}
			} else {
				errors.push('domain');
			}

			if (
				!Object.values(ProxyTypes).includes(
					data.proxyType as ProxyTypes,
				)
			) {
				errors.push('proxyType');
			}

			const defaultRepoHosts: { [host: string]: string } = {
				[ProxyTypes.GitHub]: 'https://github.com/',
				[ProxyTypes.GitLab]: 'https://gitlab.com/',
				[ProxyTypes.Bitbucket]: 'https://bitbucket.org/',
			};
			const linkData = /^(https?:\/\/[^/]+\/)?([^:/]+\/[^:/]+)(\.git|\/)?$/.exec(
				data.repository,
			);
			if (linkData) {
				parsedData.repository =
					(linkData[1] || defaultRepoHosts[parsedData.proxyType]) +
					linkData[2];
			} else {
				errors.push('repository');
			}

			if (!data.accessToken && req.body.id) {
				parsedData.accessToken =
					(
						await siteRepo.findOne(req.body.id, {
							select: ['accessToken'],
						})
					)?.accessToken || '';
			}
			if (!parsedData.accessToken) {
				errors.push('accessToken');
			}

			if (errors.length) {
				return res.render('pages/sites-edit.ejs', {
					user: req.user,
					csrfToken: req.csrfToken(),
					proxyTypes: Object.values(ProxyTypes),
					errors,
					id: req.body.id,
					data: { ...data },
					mode: req.body.mode,
				});
			}
			if (req.body.mode === 'edit') {
				await siteRepo.update(req.body.id, parsedData);
			} else {
				await siteRepo.insert(parsedData);
			}
			return res.redirect('/admin/access');
		},
	);

	app.get('/admin/edit-website', ensureIsAdmin, csrfProtection, (req, res) =>
		res.render('pages/sites-edit.ejs', {
			user: req.user,
			csrfToken: req.csrfToken(),
			proxyTypes: Object.values(ProxyTypes),
			errors: [],
			id: 0,
			data: {},
			mode: 'add',
		}),
	);

	app.post(
		'/admin/users',
		ensureIsAdmin,
		csrfProtection,
		async (req, res) => {
			const userRepo = getRepository(User);
			if (req.body.userId !== req.user!.id) {
				const user = await userRepo.findOne(req.body.userId);
				if (user) {
					if (req.body.action_promote !== undefined) {
						user.isAdmin = true;
						await userRepo.update(user.id, user);
					}
					if (req.body.action_revoke !== undefined) {
						user.isAdmin = false;
						await userRepo.update(user.id, user);
					}
					if (req.body.action_remove !== undefined) {
						await userRepo.delete(user);
					}
				}
			}
			return res.redirect('/admin/users');
		},
	);

	app.get('/admin/users', ensureIsAdmin, csrfProtection, async (req, res) => {
		return res.render('pages/users.ejs', {
			user: req.user,
			users: await getUsers(getRepository(User), req.user!),
			csrfToken: req.csrfToken(),
		});
	});

	app.use(
		'/github/*',
		openCors,
		async (req, res, next) => {
			if (!req.user) {
				return res
					.status(401)
					.json({ message: 'Not authorized' })
					.end();
			}
			const requestFilter = /^\/github\/((git|contents|pulls|branches|merges|statuses|compare|commits)\/?|(issues\/(\d+)\/labels))/;
			if (!requestFilter.test(req.originalUrl)) {
				return res.status(403).json({ message: 'forbidden' }).end();
			}
			const siteDomain = (req as any).site.domain;
			const site = siteDomain
				? await getRepository(Site).findOne({
						where: { domain: siteDomain },
						relations: ['editors'],
				  })
				: undefined;
			if (!site?.editors?.find((editor) => editor.id === req.user!.id)) {
				return res
					.status(401)
					.json({ message: 'Not authorized' })
					.end();
			}
			(req as any).site = {
				repository: site.repository,
				accessToken: site.accessToken,
			};
			next();
		},
		createProxyMiddleware({
			router: (req) =>
				(req as any).site.repository.replace(
					'https://github.com',
					'https://api.github.com/repos',
				),
			pathRewrite: { '^/github': '' },
			target: 'https://api.github.com',
			changeOrigin: true,
			onProxyReq: (proxyReq, req) => {
				proxyReq.setHeader(
					'Authorization',
					`Bearer ${(req as any).site.accessToken}`,
				);
			},
			onProxyRes: (proxyRes, req) => {
				proxyRes.headers['Access-Control-Allow-Origin'] = req.get(
					'origin',
				);
			},
		}),
	);

	app.use('/settings', openCors, (req, res) => {
		if (!req.user) {
			return res.status(401).json({ message: 'not authorized' }).end();
		}
		const site = (req as any).site as Site;
		res.json({
			github_enabled: site.proxyType === ProxyTypes.GitHub,
			gitlab_enabled: site.proxyType === ProxyTypes.GitLab,
			bitbucket_enabled: site.proxyType === ProxyTypes.Bitbucket,
			Roles: '',
		}).end();
	});

	app.use('/user', openCors, (req, res) => {
		if (!req.user) {
			return res.status(401).json({ message: 'not authorized' }).end();
		}
		res.json({
			name: req.user.name,
			email: req.user.email,
			profileImage: req.user.profileImage,
		});
	});
}
