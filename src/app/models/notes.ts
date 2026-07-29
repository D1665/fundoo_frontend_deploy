export interface Note {

    id?: number;
  
    title: string;
  
    content: string;
  
    description?: string;
  
    color: string;
  
    reminder?: string | null;
  
    createdAt?: string;
  
    updatedAt?: string;
  
    labels?: any[];
  
    ownerEmail?: string;
  
    myPermission?: string;
  
    pinned: boolean;
  
    archived: boolean;
  
    trashed: boolean;
  
    image?: string;
  collaborators?: string[];
}