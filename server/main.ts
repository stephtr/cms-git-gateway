import express from 'express';
import bodyParser from 'body-parser';
import { createConnection } from 'typeorm';
import { Arguments, getArguments } from './arguments';
import addAppRoutes from './routes';
import { setupExpressAuth } from './authentication';
import 'reflect-metadata';

async function Main({
	port,
	hostingUrl,
	authServer,
	authClientId,
	authClientSecret,
	authPkce,
	adminSub,
}: Arguments) {
	try {
		await createConnection({
			type: 'sqlite',
			database: 'db.sqlite',
			entities: ['entities/**/*.ts'],
			migrations: ['migrations/**/*.ts'],
			synchronize: true,
		});

		const app = express();
		app.disable('x-powered-by');
		app.use(bodyParser.urlencoded({ extended: true }));

		await setupExpressAuth(app, {
			server: authServer,
			clientId: authClientId,
			clientSecret: authClientSecret,
			usePKCE: authPkce,
			hostingUrl,
			adminSub,
		});

		addAppRoutes(app);

		app.listen(port, () =>
			// eslint-disable-next-line no-console
			console.log(`Server listening on http://localhost:${port}`),
		);
	} catch (error) {
		// eslint-disable-next-line no-console
		console.error(error);
	}
}

Main(getArguments());
