type PointerSample = { pointerId: number; button: number; clientX: number; clientY: number };
type Click = { x: number; y: number; time: number };

/** A right drag/long hold is never treated as a click in a double-click gesture. */
export class RightDoubleClick {
  private down: (Click & { pointerId: number; moved: boolean }) | null = null;
  private previous: Click | null = null;
  pointerDown(event: PointerSample, time: number) {
    if(event.button!==2){this.reset();return;}
    this.down={x:event.clientX,y:event.clientY,time,pointerId:event.pointerId,moved:false};
  }
  pointerMove(event: Pick<PointerSample,"pointerId"|"clientX"|"clientY">) {
    if(this.down?.pointerId===event.pointerId && Math.hypot(event.clientX-this.down.x,event.clientY-this.down.y)>6)this.down.moved=true;
  }
  pointerUp(event: PointerSample, time: number) {
    const down=this.down;this.down=null;
    if(!down || event.button!==2 || event.pointerId!==down.pointerId)return false;
    if(down.moved || time-down.time>500 || Math.hypot(event.clientX-down.x,event.clientY-down.y)>6){this.previous=null;return false;}
    const click={x:event.clientX,y:event.clientY,time};
    const double=!!this.previous && time-this.previous.time<=500 && Math.hypot(click.x-this.previous.x,click.y-this.previous.y)<=10;
    this.previous=double?null:click;return double;
  }
  reset(){this.down=null;this.previous=null;}
}
