import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface ErrorMessageProps {
    message: string;
    onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center max-w-md">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--color-danger-bg)] mb-4">
                    <AlertCircle className="w-8 h-8 text-[var(--color-danger)]" />
                </div>
                <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                    Oops! Something went wrong
                </h2>
                <p className="text-[var(--text-secondary)] mb-6">{message}</p>
                {onRetry && (
                    <Button onClick={onRetry} variant="primary">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Try Again
                    </Button>
                )}
            </div>
        </div>
    );
}
