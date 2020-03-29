import express from 'express';
import { Arguments, getArguments } from './arguments';
import addAppRoutes from './routes';
import { setupExpressAuth } from './authentication';

async function Main({
	port,
	hostingUrl,
	authServer,
	authClientId,
	authClientSecret,
	authPkce,
}: Arguments) {
	const app = express();

	await setupExpressAuth(app, {
		server: authServer,
		clientId: authClientId,
		clientSecret: authClientSecret,
		usePKCE: authPkce,
		hostingUrl,
	});

	addAppRoutes(app);

	app.listen(port, () =>
		// eslint-disable-next-line no-console
		console.log(`Server listening on http://localhost:${port}`),
	);
}

Main(getArguments());
