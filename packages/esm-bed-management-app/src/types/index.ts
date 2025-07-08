export type Tag = {
  uuid: string;
  display: string;
  name: string;
  description?: string;
  retired: boolean;
  links: Array<{
    rel: string;
    uri: string;
    resourceAlias: string;
  }>;
  resourceVersion: string;
};
export interface locationFormData {
  uuid?: string;
  name: string;
  tags: Tag;
}

export interface LocationTagsResponse {
  results: Tag[];
}

export interface InitialData {
  uuid: string;
  bedNumber: string;
  status: string;
  description: string;
  row: number;
  column: number;
  location: {
    display: string;
    uuid: string;
  };
  bedType: {
    name: string;
  };
}
