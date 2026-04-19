// src/lib/wallet.ts
import jwt from 'jsonwebtoken';
import credentials from '../../service-account.json';

// SECUIRTY & CODE QUALITY: Pulling identifiers from environment variables
const ISSUER_ID = process.env.ISSUER_ID!;
const CLASS_ID = process.env.CLASS_ID!;

export async function generateWalletPass(rewardTitle: string, delayMinutes: number) {
    const objectId = `${ISSUER_ID}.${crypto.randomUUID().replace(/-/g, '')}`;

    const claims = {
        iss: credentials.client_email,
        aud: 'google',
        typ: 'savetowallet',
        origins: ['http://localhost:3000'],
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

    // SECURITY: Properly signing the JWT using the RS256 algorithm and your private key
    const token = jwt.sign(claims, credentials.private_key, { algorithm: 'RS256' });
    return `https://pay.google.com/gp/v/save/${token}`;
}