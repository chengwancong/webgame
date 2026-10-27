export type PixelUploadFile={path:string;sha256:string;bytes:number};
export type PixelUploadPlan={available:boolean;files:PixelUploadFile[];images:number;bytes:number;complete:boolean};
export function pixelArtUploadPlan(publicRoot:string,committedManifest?:string):PixelUploadPlan;
