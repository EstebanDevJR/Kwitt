export interface Project {
  id: string;
  name: string;
  description: string;
  url: string;
  githubUrl: string;
  tags: string[];
  imageUrl?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  email?: string;
  twitter?: string;
  github?: string;
  linkedin?: string;
  website?: string;
}

export interface Profile {
  name: string;
  bio: string;
  avatar?: string;
  contact: Contact;
}

export interface Portfolio {
  id: string;
  profile: Profile;
  projects: Project[];
  createdAt: string;
  updatedAt: string;
}

export interface Intent {
  action: 'add_project' | 'update_bio' | 'update_contact' | 'delete_project' | 'reorder_projects' | 'enhance_frontend' | 'get_status' | 'unknown';
  target: string;
  data: Record<string, any>;
  confidence: number;
}

export interface AgentResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

export interface TelegramMessage {
  chatId: number;
  text: string;
  messageId: number;
  from: {
    id: number;
    firstName: string;
    username?: string;
  };
}

export interface GitCommitResult {
  hash: string;
  message: string;
  branch: string;
}