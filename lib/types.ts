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