import { Component, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarModule } from './sidebar';

@Component({
  selector: 'app-nx-welcome',
  imports: [CommonModule,SidebarModule],
  template: `
    <ng-sidebar-container
        (onBackdropClicked)="_onBackdropClicked()" style="height: 100vh;">
      <ng-sidebar
        [(opened)]="_opened"
        [mode]="_MODES[_modeNum]"
        [keyClose]="_keyClose"
        [position]="_POSITIONS[_positionNum]"
        [dock]="_dock"
        [dockedSize]="'50px'"
        [autoCollapseHeight]="_autoCollapseHeight"
        [autoCollapseWidth]="_autoCollapseWidth"
        [closeOnClickOutside]="_closeOnClickOutside"
        [closeOnClickBackdrop]="_closeOnClickBackdrop"
        [showBackdrop]="_showBackdrop"
        [animate]="_animate"
        [trapFocus]="_trapFocus"
        [autoFocus]="_autoFocus"
        [ariaLabel]="'My sidebar'"
        (onOpenStart)="_onOpenStart()"
        (onOpened)="_onOpened()"
        (onCloseStart)="_onCloseStart()"
        (onClosed)="_onClosed()"
        (onTransitionEnd)="_onTransitionEnd()">
        <p>Sidebar contents</p>

        <button class="demo-control" (click)="_toggleOpened()">Close sidebar</button>
        <p><a closeSidebar>This will close the sidebar too</a></p>

        <hr>

        <p>Throwup on your pillow.</p>
        <p>Steal the warm chair right after you get up.</p>
        <p>Use lap as chair hide head under blanket.</p>
        <p>Walk on car leaving trail of paw prints on hood.</p>
        <p>Steal the warm chair right after you get up.</p>
      </ng-sidebar>

      <div ng-sidebar-content>
        <header class="demo-header">
          <button (click)="_toggleOpened()" class="demo-header__toggle">Toggle sidebar</button>
          <span>ng-sidebar</span>
        </header>

        <section class="demo-contents">
          <h1>Options</h1>

          <h2>Sidebar</h2>

          <div>
            <button class="demo-control" (click)="_toggleOpened()">opened ({{_opened}})</button>
            <button class="demo-control" (click)="_toggleMode()">mode ({{_MODES[_modeNum]}})</button>
            <button class="demo-control" (click)="_togglePosition()">position ({{_POSITIONS[_positionNum]}})</button>
            <button class="demo-control" (click)="_toggleDock()">dock ({{_dock}})</button>
          </div>

          <div>
            <button class="demo-control" (click)="_toggleAutoCollapseHeight()">Auto collapse at 500px height ({{_autoCollapseHeight ? 'true' : 'false'}})</button>
            <button class="demo-control" (click)="_toggleAutoCollapseWidth()">Auto collapse at 500px width ({{_autoCollapseWidth ? 'true' : 'false'}})</button>
          </div>

          <div>
            <button class="demo-control" (click)="_toggleCloseOnClickOutside()">closeOnClickOutside ({{_closeOnClickOutside}})</button>
            <button class="demo-control" (click)="_toggleCloseOnClickBackdrop()">closeOnClickBackdrop ({{_closeOnClickBackdrop}})</button>
            <button class="demo-control" (click)="_toggleShowBackdrop()">showBackdrop ({{_showBackdrop}})</button>
            <button class="demo-control" (click)="_toggleAnimate()">animate ({{_animate}})</button>
          </div>

          <div>
            <button class="demo-control" (click)="_toggleTrapFocus()">trapFocus ({{_trapFocus}})</button>
            <button class="demo-control" (click)="_toggleAutoFocus()">autoFocus ({{_autoFocus}})</button>
            <button class="demo-control" (click)="_toggleKeyClose()">keyClose ({{_keyClose}})</button>
          </div>


          <h1>Documentation</h1>

          <p><a href="https://github.com/arkon/ng-sidebar#readme">See the README on GitHub for more options and info.</a></p>


          <h1>Download</h1>

          <p>Download from <a href="https://www.npmjs.com/package/ng-sidebar">NPM</a>.</p>
          <p>Source code available on <a href="https://github.com/arkon/ng-sidebar">GitHub</a>.</p>
          <p>Source code for this demo is also on <a href="https://github.com/arkon/ng-sidebar/tree/master/demo">GitHub</a>.</p>


          <h1>Some filler content</h1>

          <p>Lie on your belly and purr when you are asleep attack feet spit up on light gray carpet instead of adjacent linoleum but scream at teh bath. Throwup on your pillow steal the warm chair right after you get up for cat slap dog in face. Scratch leg; meow for can opener to feed me. Jump off balcony, onto stranger's head sleep on dog bed, force dog to sleep on floor so jump around on couch, meow constantly until given food, . Use lap as chair hide head under blanket so no one can see sleep on keyboard, for lick plastic bags intently sniff hand burrow under covers. Lick butt and make a weird face. Purr for no reason kitty loves pigs but intrigued by the shower, but scratch the furniture. Lay on arms while you're using the keyboard hate dog get video posted to internet for chasing red dot. If it smells like fish eat as much as you wish chase ball of string and favor packaging over toy. Hide head under blanket so no one can see. Kitty power! purr while eating yet lick the other cats behind the couch. Walk on car leaving trail of paw prints on hood and windshield you call this cat food? ears back wide eyed poop on grasses. Scratch the furniture flop over russian blue or eat grass, throw it back up for hide at bottom of staircase to trip human. Tuxedo cats always looking dapper scratch leg; meow for can opener to feed me. Under the bed need to chase tail claws in your leg, and loves cheeseburgers and intently stare at the same spot chase dog then run away. Nap all day lick sellotape pooping rainbow while flying in a toasted bread costume in space ignore the squirrels, you'll never catch them anyway but destroy couch. Lick yarn hanging out of own butt knock dish off table head butt cant eat out of my own dish lick plastic bags pee in the shoe. Hopped up on catnip chirp at birds kitty power! sleep nap. Climb leg damn that dog . Flee in terror at cucumber discovered on floor. Stare at ceiling light sun bathe. Dream about hunting birds when in doubt, wash or intently stare at the same spot, yet shove bum in owner's face like camera lens. Cat slap dog in face. Need to chase tail meowwww.</p>

          <p>Brown cats with pink ears stares at human while pushing stuff off a table i like big cats and i can not lie or chase laser scamper have secret plans, but fall asleep on the washing machine. Stare at ceiling destroy couch as revenge russian blue for leave fur on owners clothes slap owner's face at 5am until human fills food dish for claws in your leg stare at wall turn and meow stare at wall some more meow again continue staring . Steal the warm chair right after you get up use lap as chair howl uncontrollably for no reason for kitty scratches couch bad kitty so poop in the plant pot, wake up wander around the house making large amounts of noise jump on top of your human's bed and fall asleep again. Paw at beetle and eat it before it gets away chase dog then run away. Sleep on dog bed, force dog to sleep on floor i am the best refuse to leave cardboard box yet lounge in doorway but Gate keepers of hell. My left donut is missing, as is my right destroy the blinds refuse to leave cardboard box. Ears back wide eyed shake treat bag. Lick butt present belly, scratch hand when stroked, eat the fat cats food, why must they do that favor packaging over toy. Scratch leg; meow for can opener to feed me shove bum in owner's face like camera lens. Missing until dinner time meow. Attack the dog then pretend like nothing happened run in circles, and steal the warm chair right after you get up and inspect anything brought into the house, yet poop in litter box, scratch the walls. Sit in window and stare ooo, a bird! yum hide when guests come over rub face on everything, so knock dish off table head butt cant eat out of my own dish pee in the shoe sit in box. Pelt around the house and up and down stairs chasing phantoms bleghbleghvomit my furball really tie the room together yet all of a sudden cat goes crazy, and get video posted to internet for chasing red dot. Inspect anything brought into the house scratch leg; meow for can opener to feed me but bathe public parts with tongue then lick owner's face kitty power! . Hola te quiero use lap as chair. Intently sniff hand eat a plant, kill a hand or lick the other cats but climb a tree, wait for a fireman jump to fireman then scratch his face yet meowing non stop for food. Thug cat immediately regret falling into bathtub so sit on human kitty scratches couch bad kitty. Please stop looking at your phone and pet me. Lounge in doorway destroy couch, and if it fits, i sits wake up human for food at 4am. Instantly break out into full speed gallop across the house for no reason chew on cable leave fur on owners clothes yet chase mice, so gnaw the corn cob so throwup on your pillow. Intrigued by the shower scratch the furniture but shove bum in owner's face like camera lens so wake up wander around the house making large amounts of noise jump on top of your human's bed and fall asleep again yet sit on the laptop. Love to play with owner's hair tie thug cat drink water out of the faucet. I am the best kick up litter yet hide from vacuum cleaner and behind the couch, attack feet gnaw the corn cob. Howl uncontrollably for no reason human give me attention meow for hola te quiero.</p>

          <p>Sit on human gnaw the corn cob but lounge in doorway yet ears back wide eyed. Hide when guests come over rub face on everything, fall asleep on the washing machine you call this cat food? for wake up wander around the house making large amounts of noise jump on top of your human's bed and fall asleep again for spread kitty litter all over house. If it fits, i sits eat grass, throw it back up stick butt in face. Peer out window, chatter at birds, lure them to mouth. Put toy mouse in food bowl run out of litter box at full speed inspect anything brought into the house, for eat prawns daintily with a claw then lick paws clean wash down prawns with a lap of carnation milk then retire to the warmest spot on the couch to claw at the fabric before taking a catnap chase laser. Human give me attention meow spit up on light gray carpet instead of adjacent linoleum for hunt by meowing loudly at 5am next to human slave food dispenser thinking longingly about tuna brine. Asdflkjaertvlkjasntvkjn (sits on keyboard) stare at the wall, play with food and get confused by dust flop over need to chase tail damn that dog so mew get video posted to internet for chasing red dot. Groom yourself 4 hours - checked, have your beauty sleep 18 hours - checked, be fabulous for the rest of the day - checked! cats go for world domination for stare at ceiling, or purr while eating yet kitty loves pigs.</p>

          <p>Text from <a href="http://www.catipsum.com/">Cat Ipsum</a>.</p>
        </section>
      </div>
    </ng-sidebar-container>
  `,
  styles: [
    `
    ::selection {
  background-color: #0273d4;
  color: #fff;
}

a {
  color: #0273d4;
  text-decoration: none;
}
  a:hover {
    border-bottom: 1px dotted #0273d4;
  }

p {
  margin-bottom: 1em;
}

h1,
h2 {
  font-weight: 300;
}

h1 {
  border-bottom: 1px dotted #0273d4;
  display: block;
  margin: 2rem 0 1rem;
  padding-bottom: 0.5rem;
}

h2 {
  margin: 0.5rem 0;
}

.loading {
  padding: 1em;
}

aside {
  background-color: #fff;
  padding: 2em 1em;
}

.demo-header {
  align-items: center;
  background: #0273d4;
  color: #fff;
  display: flex;
  padding: 1em;
  position: sticky;
  top: 0;
}

  .demo-header__toggle {
    background: transparent;
    border: 0.15rem solid #fff;
    border-left: 0;
    border-right: 0;
    cursor: pointer;
    font-size: 0;
    height: 1.5rem;
    margin-right: 1rem;
    position: relative;
    width: 2rem;
  }
    .demo-header__toggle:after {
      background: #fff;
      content: '';
      height: 0.15rem;
      left: 0;
      margin-top: -0.075rem;
      position: absolute;
      top: 50%;
      width: 100%;
    }
    
  .demo-sidebar.ng-sidebar--opened.ng-sidebar--over {
    box-shadow: 0 0 2.5em rgba(85, 85, 85, 0.5);
  }

.demo-contents {
  padding: 0 2em;
}

.demo-control {
  background-color: #f6f6f6;
  border: 1px solid #545555;
  cursor: pointer;
  margin-bottom: 0.5em;
  padding: 0.5em 2em;
  transition: background-color 0.15s;
}
.demo-control:hover {
    background-color: #545555;
    color: #fff;
  }
    `
  ],
  encapsulation: ViewEncapsulation.None,
})
export class NxWelcome {
  public _opened: boolean = false;
  public _modeNum: number = 0;
  public _positionNum: number = 0;
  public _dock: boolean = false;
  public _closeOnClickOutside: boolean = false;
  public _closeOnClickBackdrop: boolean = false;
  public _showBackdrop: boolean = false;
  public _animate: boolean = true;
  public _trapFocus: boolean = true;
  public _autoFocus: boolean = true;
  public _keyClose: boolean = false;
  public _autoCollapseHeight: number | undefined = undefined;
  public _autoCollapseWidth: number | undefined = undefined;

  public _MODES: Array<'over' | 'push' | 'slide'> = ['over', 'push', 'slide'];
  public _POSITIONS: Array<'start' | 'end' | 'left' | 'right' | 'top' | 'bottom'> = ['left', 'right', 'top', 'bottom'];

  public _toggleOpened(): void {
    this._opened = !this._opened;
  }

  public _toggleMode(): void {
    this._modeNum++;

    if (this._modeNum === this._MODES.length) {
      this._modeNum = 0;
    }
  }

  public _toggleAutoCollapseHeight(): void {
    this._autoCollapseHeight = this._autoCollapseHeight ? undefined : 500;
  }

  public _toggleAutoCollapseWidth(): void {
    this._autoCollapseWidth = this._autoCollapseWidth ? undefined : 500;
  }

  public _togglePosition(): void {
    this._positionNum++;

    if (this._positionNum === this._POSITIONS.length) {
      this._positionNum = 0;
    }
  }

  public _toggleDock(): void {
    this._dock = !this._dock;
  }

  public _toggleCloseOnClickOutside(): void {
    this._closeOnClickOutside = !this._closeOnClickOutside;
  }

  public _toggleCloseOnClickBackdrop(): void {
    this._closeOnClickBackdrop = !this._closeOnClickBackdrop;
  }

  public _toggleShowBackdrop(): void {
    this._showBackdrop = !this._showBackdrop;
  }

  public _toggleAnimate(): void {
    this._animate = !this._animate;
  }

  public _toggleTrapFocus(): void {
    this._trapFocus = !this._trapFocus;
  }

  public _toggleAutoFocus(): void {
    this._autoFocus = !this._autoFocus;
  }

  public _toggleKeyClose(): void {
    this._keyClose = !this._keyClose;
  }

  public _onOpenStart(): void {
    console.info('Sidebar opening');
  }

  public _onOpened(): void {
    console.info('Sidebar opened');
  }

  public _onCloseStart(): void {
    console.info('Sidebar closing');
  }

  public _onClosed(): void {
    console.info('Sidebar closed');
  }

  public _onTransitionEnd(): void {
    console.info('Transition ended');
  }

  public _onBackdropClicked(): void {
    console.info('Backdrop clicked');
  }
}


// #     # 1. Drop your current Jest
// # npm uninstall jest ts-jest

// # # 2. Install the matching versions
// # npm install --save-dev jest@29.7.0 ts-jest@29.4.1

// # # 3. Clean slate and reinstall everything
// # rm -rf node_modules package-lock.json
// # npm cache clean --force
// # npm install
