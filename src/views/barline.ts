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
import _ = require("lodash");

import Attributes from "./attributes";
import Barline from "../models/barline";
import Line from "./primitives/line";

/**
 * Renders a full-stave-height barline at (x,y).
 * Does not do any interesting calculations.
 */
class BarlineView extends Component<{layout: Barline.ILayout}, {}> {
    render(): any {
        const originX = this.context.originX;
        const originY = this.context.originY;

        const layout = this.props.layout;
        const model = layout.model;

        const x = originX + model.defaultX;
        const y = originY - model.defaultY;

        // TODO: render MusicXML.BarStyleType.Dashed:
        // TODO: render MusicXML.BarStyleType.Dotted:
        // TODO: render MusicXML.BarStyleType.Short:
        // TODO: render MusicXML.BarStyleType.Tick:

        let yTop: number;
        let yBottom: number;
        if (layout.partSymbol && layout.partSymbol.type !== MusicXML.PartSymbolType.None) {
            yTop = this.context.systemTop;
            yBottom = this.context.systemBottom;
        } else {
            yTop = y - layout.height - layout.yOffset;
            yBottom = y + layout.height - layout.yOffset;
        }

        if (model.satieAttributes) {
            model.satieAttributes.overrideX = layout.overrideX + model.satieAttribsOffset;
        }

        return DOM.g(null,
            _.map(layout.lineStarts, (start, idx) => $(Line)({
                fill: model.barStyle.color,
                key: idx,
                stroke: model.barStyle.color,
                strokeWidth: layout.lineWidths[idx],
                x1: x + start + layout.lineWidths[idx]/2,
                x2: x + start + layout.lineWidths[idx]/2,
                y1: yTop,
                y2: yBottom
            })),
            model.satieAttributes && $(Attributes)({
                layout: model.satieAttributes
            })
        /* DOM.g */);
    }
};

module BarlineView {
    export let contextTypes = <any> {
        originX: PropTypes.number.isRequired,
        originY: PropTypes.number.isRequired,
        systemBottom: PropTypes.number.isRequired,
        systemTop: PropTypes.number.isRequired
    };
}

export default BarlineView;
