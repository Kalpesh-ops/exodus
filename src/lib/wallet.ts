// src/lib/wallet.ts
import { JWT } from 'google-auth-library';
import credentials from '../../service-account.json';

// In a real production app, these would be in .env variables.
// For the hackathon, we will define them here once you get them from the console.
const ISSUER_ID = "YOUR_ISSUER_ID";
const CLASS_ID = "YOUR_CLASS_ID"; // We will create a "Generic Class" in the console later

export async function generateWalletPass(rewardTitle: string, delayMinutes: number) {
    // SECURITY: Using JWT (JSON Web Tokens) to securely sign the pass payload
    const client = new JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
    });

    // EFFICIENCY: Building a lightweight Generic Object payload
    const objectId = `${ISSUER_ID}.${crypto.randomUUID().replace(/-/g, '')}`;

    const passPayload = {
        aud: 'google',
        origins: ['http://localhost:3000'], // Allows saving from your local frontend
        iss: credentials.client_email,
        typ: 'savetowallet',
        payload: {
            genericObjects: [
                {
                    id: objectId,
                    classId: `${ISSUER_ID}.${CLASS_ID}`,
                    genericType: 'GENERIC_TYPE_UNSPECIFIED',
                    hexBackgroundColor: '#4285f4', // Google Blue
                    logo: {
                        sourceUri: {
                            uri: 'https://fonts.gstatic.com/s/i/short-term/release/googlesymbols/stadium/default/24px.svg'
                        }
                    },
                    cardTitle: {
                        defaultValue: {
                            language: 'en',
                            value: 'Exodus Gate Incentive'
                        }
                    },
                    header: {
                        defaultValue: {
                            language: 'en',
                            value: rewardTitle
                        }
                    },
                    subheader: {
                        defaultValue: {
                            language: 'en',
                            value: `Thank you for waiting ${delayMinutes} minutes!`
                        }
                    },
                    barcode: {
                        type: 'QR_CODE',
                        value: objectId, // Scannable ID for stadium staff
                    }
                }
            ]
        }
    };

    // Sign the payload into a URL
    const token = await client.sign(passPayload);
    return `https://pay.google.com/gp/v/save/${token}`;
}