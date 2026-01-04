export type EntryPassUser = {
    roll: string;
    name?: string;
    department?: string;
};

export type ListItem = {
    name: string;
    type: string;
};

export type Toast = {
    id: number;
    message: string;
    loading?: boolean;
    error?: boolean;
};

export type ToastOptions = {
    loading?: boolean;
    error?: boolean;
    duration?: number;
};
