presentationLib.ResManager=function(a){var b=this;this.downloadQueue=[];this.cache={};this.successCount=0;this.failureCount=0;this.queueDownload=function(c){b.downloadQueue.push(c)};this.getAsset=function(c){return this.cache[c]};this.downloadAll=function(e){if(this.downloadQueue.length===0){e()}var c;for(var d=0;d<this.downloadQueue.length;d++){var f=b.downloadQueue[d];c=new Image();c.addEventListener("load",function(){b.successCount+=1;if(b.isDone()){e()}},false);c.addEventListener("error",function(){b.failureCount+=1;if(b.isDone()){e()}},false);c.src=f;c.className="imageContainer";c.draggable=false;b.cache[f]=c}};this.isDone=function(){return(this.downloadQueue.length===this.successCount+this.failureCount)};this.downloadCallback=function(){a.log("download finished")};this.clearCache=function(){b.cache={};b.successCount=0;b.failureCount=0};this.createArrayOfLevelAssets=function(g,d){var f=[];for(var e=0;e<d;e++){var c=e<10?"00"+e:"0"+e;f.push("tile_"+c+"_"+g)}return f};this.clearCacheForLevel=function(h,c){var g=b.createArrayOfLevelAssets(h,c);var d={};for(var f in g){for(var e in b.cache){if(e.indexOf(g[f])!=-1){d[e]=b.cache[e]}}}b.cache=d};this.clearDownloadQueue=function(){b.downloadQueue.length=0;b.successCount=0;b.failureCount=0};return this};