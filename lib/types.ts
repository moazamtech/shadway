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

export interface Template {
  _id?: string;
  name: string;
  description: string;
  image: string;
  demoUrl: string;
  purchaseUrl: string;
  price: number;
  featured?: boolean;
  sequence?: number;
  downloads?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TemplateFormData {
  name: string;
  description: string;
  image: string;
  demoUrl: string;
  purchaseUrl: string;
  price: number;
  featured: boolean;
  sequence?: number;
}

export interface ComponentRegistry {
  name: string;
  type: string;
  title: string;
  description: string;
  files: {
    path: string;
    content: string;
    type: string;
  }[];
  dependencies: string[];
  registryDependencies: string[];
}
