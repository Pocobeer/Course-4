import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

const getToken = () => localStorage.getItem('auth_token');

export interface ApiError {
    message: string;
    response?: {
        data?: {
            message?: string;
        };
    };
}

export interface Plot {
    id: number;
    owner_id: number;
    renter_id: number | null;
    price_item_id: number;
    address: string;
    area: number;
    description: string;
    status: 'available' | 'rented' | 'reserved';
    price_per_day: number;
    owner_name: string;
    owner_phone: string;
}

export interface PlotsResponse {
    data: Plot[];
    total?: number;
    page?: number;
    limit?: number;
}

export interface LoginResponse {
    message: string;
    token: string;
    user: {
        id: number;
        name: string;
        phone: string;
        email: string;
        role: string;
        created_at: string;
    };
}

export interface UserProfile {
    id: number;
    name: string;
    phone: string;
    email: string;
    role: string;
    created_at: string;
}

export interface RentalApplication {
    id: number;
    plot_id: number;
    renter_id: number;
    start_date: string;
    end_date: string;
    status:
        | 'pending'
        | 'approved'
        | 'rejected'
        | 'active'
        | 'completed'
        | 'cancelled';
    created_at: string;
    rejection_reason: string | null;
    plot_address: string;
    plot_area: number;
    renter_name: string;
    renter_phone: string;
    owner_name: string;
}

export interface ApplicationsResponse {
    data: RentalApplication[];
    total?: number;
    page?: number;
    limit?: number;
}

export interface PlotDetails {
    id: number;
    owner_id: number;
    renter_id: number | null;
    price_item_id: number;
    address: string;
    area: number;
    description: string;
    status: 'available' | 'rented' | 'reserved';
    price_per_day?: number;
    owner_name?: string;
    owner_phone?: string;
}

export interface CreateApplicationRequest {
    plot_id: number;
    start_date: string;
    end_date: string;
}

export interface CreateApplicationResponse {
    message: string;
    application: {
        id: number;
        plot_id: number;
        renter_id: number;
        start_date: string;
        end_date: string;
        status: string;
        created_at: string;
        rejection_reason: string | null;
    };
}

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const login = async (
    phone: string,
    password: string
): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/login', {
        phone,
        password,
    });
    localStorage.setItem('auth_token', response.data.token);
    return response.data;
};

export const fetchPlots = async (
    status: string = 'available',
    page: number = 1,
    limit: number = 10
): Promise<PlotsResponse> => {
    const response = await api.get<PlotsResponse>('/plots', {
        params: { status, page, limit },
    });
    return response.data;
};

export const fetchProfile = async (): Promise<UserProfile> => {
    const response = await api.get<UserProfile>('/profile');
    return response.data;
};

export const updateProfile = async (
    data: Partial<UserProfile>
): Promise<UserProfile> => {
    const response = await api.put<UserProfile>('/profile', data);
    return response.data;
};

export const fetchApplications = async (
    page: number = 1,
    limit: number = 10
): Promise<ApplicationsResponse> => {
    const response = await api.get<ApplicationsResponse>('/applications', {
        params: { page, limit },
    });
    return response.data;
};

export const fetchPlotById = async (id: number): Promise<PlotDetails> => {
    const response = await api.get<PlotDetails>(`/plots/${id}`);
    return response.data;
};

export const createApplication = async (
    data: CreateApplicationRequest
): Promise<CreateApplicationResponse> => {
    const response = await api.post<CreateApplicationResponse>(
        '/applications',
        data
    );
    return response.data;
};

export const approveApplication = async (id: number): Promise<void> => {
    const response = await api.put(`/applications/${id}/approve`);
    return response.data;
};

export const rejectApplication = async (
    id: number,
    reason: string
): Promise<void> => {
    const response = await api.put(`/applications/${id}/reject`, { reason });
    return response.data;
};

export const cancelApplication = async (id: number): Promise<void> => {
    const response = await api.put(`/applications/${id}/cancel`);
    return response.data;
};

export const logout = () => {
    localStorage.removeItem('auth_token');
};
