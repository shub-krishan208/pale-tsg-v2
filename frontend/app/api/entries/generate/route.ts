import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Pass the request to the Django backend to get the signed token
        const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
        const backendRes = await fetch(`${backendUrl}/api/entries/generate/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!backendRes.ok) {
            const errorText = await backendRes.text();
            return NextResponse.json({ error: errorText }, { status: backendRes.status });
        }

        const data = await backendRes.json();
        const token = data.token;

        if (token) {
            // Verify the signature using the public key
            const pubKeyPath = path.join(process.cwd(), 'keys', 'public.pem');
            if (fs.existsSync(pubKeyPath)) {
                const publicKey = fs.readFileSync(pubKeyPath, 'utf-8');
                try {
                    jwt.verify(token, publicKey, { algorithms: ['RS256'] });
                } catch (verifyError: any) {
                    return NextResponse.json({ error: 'Token verification failed on webapp: ' + verifyError.message }, { status: 400 });
                }
            } else {
                console.warn('public.pem not found in frontend/keys/. Skipping verification.');
            }
        }

        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Error in Next.js generate route:', error);
        return NextResponse.json({ error: 'Next.js Proxy Error: ' + error.message, stack: error.stack }, { status: 500 });
    }
}
