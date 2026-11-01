export class AlbumState{
  constructor(){this.album=null;this.spread=0;}
  open(album){if(!album.photoIds?.length)throw new Error('This album has no photographs.');this.album=album;this.spread=0;}
  get count(){return this.album?Math.ceil(this.album.photoIds.length/2):0;}
  get pages(){return this.album?this.album.photoIds.slice(this.spread*2,this.spread*2+2):[];}
  get last(){return !!this.album&&this.spread===this.count-1;}
  next(){if(!this.album)return 'closed';if(this.last){this.close();return 'closed';}this.spread++;return 'turned';}
  previous(){this.spread=Math.max(0,this.spread-1);}
  close(){this.album=null;this.spread=0;}
}
