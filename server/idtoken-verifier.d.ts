declare module 'idtoken-verifier' {
	interface Parameters {
		/** name of the issuer of the token that should match the `iss` claim in the id_token */
		issuer: string;
		/** identifies the recipients that the JWT is intended for and should match the `aud` claim */
		audience: string;
		/** number of seconds that the clock can be out of sync while validating expiration of the id_token */
		leeway?: number;
		/** cache for JSON Web Token Keys. By default it has no cache */
		jwksCache?: any;
		/** A valid, direct URI to fetch the JSON Web Key Set (JWKS). */
		jwksURI?: string;
		/** algorithm in which the id_token was signed and will be used to validate */
		expectedAlg?: string;
	}

	class IdTokenVerifier {
		constructor(parameters: Parameters);

		/**
		 * Verifies an id_token
		 *
		 * It will validate:
		 * - signature according to the algorithm configured in the verifier.
		 * - if nonce is present and matches the one provided
		 * - if `iss` and `aud` claims matches the configured issuer and audience
		 * - if token is not expired and valid (if the `nbf` claim is in the past)
		 */
		verify(
			token: string,
			requestedNonce: string | null,
			callback: (error: Error, payload: any) => void,
		): void;

		/** This method will decode the token header and payload WITHOUT doing any verification. */
		decode(
			token: string,
		): {
			header: any;
			payload: any;
			encoded: {
				header: string;
				payload: string;
				signature: string;
			};
		};
	}

	export = IdTokenVerifier;
}
