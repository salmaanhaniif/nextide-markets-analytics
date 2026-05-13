import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/src/components/ui/AppShell';
import { ModelProvider } from '@/src/contexts/ModelContext';

export const metadata: Metadata = {
    title: 'NexTide Analytics — Market Prediction Dashboard',
    description:
        'AI-powered market prediction and trading signals using XGBoost, PCA, and NLP sentiment analysis.',
};

export default function RootLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en">
            <body>
                <ModelProvider>
                    <AppShell>{children}</AppShell>
                </ModelProvider>
            </body>
        </html>
    );
}
