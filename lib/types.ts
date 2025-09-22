export interface Website {
  _id?: string;
  name: string;
  description: string;
  url: string;
  image: string;
  category: string;
  tags?: string[];
  featured?: boolean;
  sequence?: number;
  sponsor?: {
    tier: 'banner' | 'premium' | 'basic';
    active: boolean;
    expiresAt?: Date;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface User {
  _id?: string;
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'user';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WebsiteFormData {
  name: string;
  description: string;
  url: string;
  image: string;
  category: string;
  tags: string[];
  featured: boolean;
  sequence?: number;
}

export interface Submission {
  _id?: string;
  name: string;
  email: string;
  websiteName: string;
  websiteUrl: string;
  description: string;
  category: string;
  githubUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt?: Date;
  updatedAt?: Date;
}