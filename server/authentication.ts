import fetch from 'node-fetch';

export interface Profile {
	id: string;
	name: string;
	email: string;
}

export interface VerifiedProfile extends Profile {
	emailVerified: boolean;
}

export const userProfileProvider = (userInfoURL: string) => async (
	accessToken: string,
	done: (error?: Error | null, profile?: VerifiedProfile) => void,
) => {
	try {
		const data = await fetch(userInfoURL, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		});
		const obj = await data.json();
		if (!obj.sub) {
			throw new Error('OIDC: Expected `sub` to be set.');
		}
		if (!obj.name) {
			throw new Error('OIDC: Expected `name` to be set.');
		}
		if (!obj.email) {
			throw new Error('OIDC: Expected `email` to be set.');
		}
		done(null, {
			id: obj.sub,
			name: obj.name,
			email: obj.email,
			emailVerified: obj.email_verified,
		});
	} catch (error) {
		done(error);
	}
};

export async function getAuthSettings(authServer: string) {
	const url = `${authServer}/.well-known/openid-configuration`;
	try {
		const data = await (await fetch(url)).json();
		return {
			authorizationURL: data.authorization_endpoint,
			tokenURL: data.token_endpoint,
			userInfoURL: data.userinfo_endpoint,
		};
	} catch (error) {
		throw new Error(`Can't fetch OIDC config for ${url}`);
	}
}
