/**
 * (C) Josh Netterfield <joshua@nettek.ca> 2015.
 * Part of the Satie music engraver <https://github.com/ripieno/satie>.
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";

import MusicXML = require("musicxml-interfaces");
import {createFactory as $, Component, DOM, PropTypes} from "react";

import Glyph from "./primitives/glyph";
import SMuFL from "../models/smufl";

class UnbeamedTuplet extends Component<{spec: MusicXML.Tuplet}, void> {
    render() {
        return DOM.g(null,
            DOM.polygon({
                fill: this.props.stroke,
                key: "p1",
                points: this._getX1() + "," + this._getY1(0) + " " +
                    this._getX2() + "," + this._getY2(0) + " " +
                    this._getX2() + "," + this._getY2(1) + " " +
                    this._getX1() + "," + this._getY1(1),
                stroke: this.props.stroke,
                strokeWidth: 0
            }),
            DOM.line({
                fill: this.props.stroke,
                key: "p2",
                stroke: this.props.stroke,
                strokeWidth: SMuFL.bravura.engravingDefaults.tupletBracketThickness*10,
                x1: this._getX1(),
                x2: this._getX1(),
                y1: this._getY1(this.props.direction === -1 ? 1 : 0),
                y2: this._getY1(this.props.direction === -1 ? 0 : 1) + 4*this.props.direction
            }),
            DOM.line({
                fill: this.props.stroke,
                key: "p3",
                stroke: this.props.stroke,
                strokeWidth: SMuFL.bravura.engravingDefaults.tupletBracketThickness*10,
                x1: this._getX2(),
                x2: this._getX2(),
                y1: this._getY2(this.props.direction === -1 ? 1 : 0),
                y2: this._getY2(this.props.direction === -1 ? 0 : 1) + 4*this.props.direction
            }),
            this._tuplet()
        );
    }

    /**
     * Offset because the note-head has a non-zero width.
     */
    getLineXOffset() {
        return this.direction() * -this.props.stemWidth / 2;
    }

    /**
     *  1 if the notes go up,
     * -1 if the notes go down.
     */
    direction() {
        return this.props.direction;
    }

    private _withXOffset(x: number) {
        // Note that we use notehadBlack regardless of the note-bhead.
        // This keeps spacing consistent, even in beam groups with rests.
        return x +
            SMuFL.getFontOffset("noteheadBlack", this.direction())[0]*10 +
                this.getLineXOffset();
    }

    private _getX1() {
        return this._withXOffset(this.props.x);
    }

    private _getX2() {
        return this._withXOffset(this.props.x + this.props.width);
    }

    private _getY1(incl: number) {
        // Note that we use notehadBlack regardless of the notehead.
        // This keeps spacing consistent, even in beam groups with rests.
        return this.props.y -
            this._getYOffset() -
            this.direction()*SMuFL.getFontOffset("noteheadBlack", this.direction())[1]*10 -
            (this.props.line1 - 3)*10 +
            (incl || 0)*(SMuFL.bravura.engravingDefaults.tupletBracketThickness*10);
    }

    private _getY2(incl: number) {
        // Note that we use notehadBlack regardless of the notehead.
        // This keeps spacing consistent, even in beam groups with rests.
        return this.props.y -
            this._getYOffset() -
            this.direction()*SMuFL.getFontOffset("noteheadBlack", this.direction())[1]*10 -
            (this.props.line2 - 3)*10 +
            (incl || 0)*(SMuFL.bravura.engravingDefaults.tupletBracketThickness*10);
    }

    /**
     * Offset because the note-head has a non-zero height.
     * The note-head is NOT CENTERED at its local origin.
     */
    private _getYOffset() {
        if (this.direction() === -1) {
            return 1;
        }
        return 0.2;
    }

    /**
     * Returns a component instance showing the tuplet number
     */
    private _tuplet() {
        if (!this.props.tuplet) {
            return null;
        } else {
            let symbol = "tuplet" + (this.props.tuplet.actualNotes.count.toString()[0]);
            let bbox = SMuFL.bboxes[symbol];
            let width = (bbox[2] - bbox[0])*10;
            let offset = (this._getX2() - this._getX1())/2 - this.props.direction*width/2;
            let y = (this._getY1(1) +
                        this._getY2(1))/2 + 5.8;

            return DOM.g(null,
                /* TODO: We should simply not draw here. This breaks transparent backgrounds! */
                DOM.polygon({
                    fill: "white",
                    points: (
                        (this.props.x + offset - bbox[0]*10 + 4) + "," + (y - bbox[1]*10) + " " +
                        (this.props.x + offset - bbox[0]*10 + 4) + "," + (y + bbox[3]*10) + " " +
                        (this.props.x + offset + bbox[1]*10 + 4) + "," + (y + bbox[3]*10) + " " +
                        (this.props.x + offset + bbox[1]*10 + 4) + "," + (y - bbox[1]*10)),
                    stroke: "white",
                    strokeWidth: 0
                }),
                $(Glyph)({
                    fill: this.props.tupletsTemporary ? "#A5A5A5" : "#000000",
                    glyphName: symbol,
                    x: this.props.x + offset,
                    y: y
                })
            /* DOM.g */);
        }
    }
};

module UnbeamedTuplet {
    export let contextTypes = <any> {
        originY: PropTypes.number.isRequired
    };
}

export default UnbeamedTuplet;
