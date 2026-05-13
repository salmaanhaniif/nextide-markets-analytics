'use client';

import { createContext, useContext, useState } from 'react';

export type ModelId = 'xgboost' | 'lstm';

interface ModelContextValue {
    selectedModel: ModelId;
    setSelectedModel: (id: ModelId) => void;
}

const ModelContext = createContext<ModelContextValue>({
    selectedModel: 'xgboost',
    setSelectedModel: () => {},
});

export function ModelProvider({ children }: { children: React.ReactNode }) {
    const [selectedModel, setSelectedModel] = useState<ModelId>('xgboost');
    return (
        <ModelContext.Provider value={{ selectedModel, setSelectedModel }}>
            {children}
        </ModelContext.Provider>
    );
}

export function useModel(): ModelContextValue {
    return useContext(ModelContext);
}
