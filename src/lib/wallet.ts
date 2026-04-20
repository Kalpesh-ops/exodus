// src/lib/wallet.ts
import jwt from 'jsonwebtoken';
import credentials from '../../service-account.json';

// SECURITY & CODE QUALITY: Pulling identifiers from environment variables
const ISSUER_ID = process.env.ISSUER_ID!;
const CLASS_ID = process.env.CLASS_ID!;

// SECURITY: Production origin from env, falling back to localhost only for dev
const WALLET_ORIGIN = process.env.WALLET_ORIGIN || 'http://localhost:3000';

export async function generateWalletPass(rewardTitle: string, delayMinutes: number) {
    const objectId = `${ISSUER_ID}.${crypto.randomUUID().replace(/-/g, '')}`;

    const claims = {
        iss: credentials.client_email,
        aud: 'google',
        typ: 'savetowallet',
        origins: [WALLET_ORIGIN],
        payload: {
            genericObjects: [
                {
                    id: objectId,
                    classId: `${ISSUER_ID}.${CLASS_ID}`,
                    genericType: 'GENERIC_TYPE_UNSPECIFIED',
                    hexBackgroundColor: '#4285f4',
                    logo: {
                        sourceUri: { uri: 'https://fonts.gstatic.com/s/i/short-term/release/googlesymbols/stadium/default/24px.svg' }
                    },
                    cardTitle: {
                        defaultValue: { language: 'en', value: 'Exodus Gate Incentive' }
                    },
                    header: {
                        defaultValue: { language: 'en', value: rewardTitle }
                    },
                    subheader: {
                        defaultValue: { language: 'en', value: `Thank you for waiting ${delayMinutes} minutes!` }
                    },
                    barcode: {
                        type: 'QR_CODE',
                        value: objectId,
                    }
                }
            ]
        }
    };

    // SECURITY: Properly signing the JWT using the RS256 algorithm and your private key.
    // Token expires in 1 hour to prevent indefinite reuse of wallet links.
    const token = jwt.sign(claims, credentials.private_key, {
        algorithm: 'RS256',
        expiresIn: '1h',
    });
    return `https://pay.google.com/gp/v/save/${token}`;
}