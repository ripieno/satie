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

/**
 * @file engine/_processMeasure.ts provides function for validating or laying out a measure
 */

"use strict";

import MusicXML         = require("musicxml-interfaces");
import _                = require("lodash");
import invariant        = require("react/lib/invariant");

import Measure          = require("./measure");
import ICursor          = require("./icursor");
import IModel           = require("./imodel");
import Ctx              = require("./ctx");

/**
 * Given a cursor skeleton, creates a detached mutable cursor.
 * 
 * For use by _processMeasure.
 */
function createCursor(
        spec: {
            segment: Measure.ISegment;
            voice: Ctx.IVoice;
            staff: Ctx.IStaff;
            measure: Ctx.IMeasure;
            line: Ctx.ILine;
            prev: IModel;
            x: number;
            _approximate: boolean;
            _detached: boolean;
            factory: IModel.IFactory;
        }): ICursor {
    return {
        segment: spec.segment,
        idx$: 0,
        line: spec.line,
        print$: null,
        header: null,
        measure: spec.measure,
        staff: Ctx.IStaff.detach(spec.staff),
        voice: spec.voice,
        prev$: spec.prev,
        division$: 0,
        x$: spec.x,
        maxPaddingBottom$: 0,
        maxPaddingTop$: 0,
        approximate: spec._approximate,
        detached: spec._detached,
        factory: spec.factory
    };
}

/** 
 * Given a bunch of segments and the context (measure, line), returns information needed to lay the
 * models out. Note that the order of the output is arbitrary and may not correspond to the order
 * of the input segments.
 * 
 * @segments Models to lay out.
 * @measure Model to which the model belongs to.
 * @line Line context
 * 
 * Complexity: O(staff-voice pairs)
 */
function _processMeasure(spec: _processMeasure.ILayoutOpts): Measure.IMeasureLayout {
    let segments                    = spec.segments;
    let line                        = spec.line;
    let measure                     = spec.measure;
    let prevByStaff                 = spec.prevByStaff;
    let validateOnly                = spec._validateOnly;
    let lastAttribs                 = spec.attributes;

    invariant(segments.length >= 1, "_processMeasure expects at least one segment.");

    let staffMeasure                = _.indexBy(_.filter(segments,
            seg => seg.ownerType === Measure.OwnerType.Staff), "owner");
    let voiceMeasure                = _.indexBy(_.filter(segments,
            seg => seg.ownerType === Measure.OwnerType.Voice), "owner");

    let staffLayouts$: { [key: number]: IModel.ILayout[][] } = {};

    let maxXInMeasure               = 0;
    let maxPaddingTopInMeasure$     = 0;
    let maxPaddingBottomInMeasure$  = 0;

    let voiceLayouts$   = _.map(voiceMeasure, segment => {
        let voice                                                   = <Ctx.IVoice> {};

        let voiceStaves$:        {[key: number]: IModel.ILayout[]}  = {};
        let staffContexts$:      {[key: number]: Ctx.IStaff}        = {};
        let divisionPerStaff$:   {[key: string]: number}            = {};

        let cursor$ = createCursor({
            segment:        segment,
            idx$:           0,

            voice:          voice,
            staff:          null,
            measure:        measure,
            line:           line,

            prev:           prevByStaff ? prevByStaff[0] : null, // FIXME!
            division$:      0,
            x:              measure.x,

            _approximate:   spec._approximate,
            _detached:      spec._detached,
            factory:        spec.factory
        });

        /**
         * Processes a staff model within this voice's context.
         */
        function pushStaffSegment(staffIdx: number, model: IModel) {
            if (!model) {
                console.log("No model at", staffIdx);
                console.log(staffMeasure);
                console.log("VS:", voiceStaves$)
                console.log(divisionPerStaff$[staffIdx], cursor$.division$);
            }
            let oldDivision                 = cursor$.division$;
            let oldSegment                  = cursor$.segment;
            cursor$.division$               = divisionPerStaff$[staffIdx];
            cursor$.segment                 = staffMeasure[staffIdx];
            let layout: IModel.ILayout;
            if (validateOnly) {
                model.staffIdx = cursor$.staff.idx;
                model.validate$(cursor$);
            } else {
                layout                      = model.layout(cursor$);
            }
            cursor$.division$               += model.divCount;
            divisionPerStaff$[staffIdx]     = cursor$.division$;
            cursor$.division$               = oldDivision;
            cursor$.prev$                   = model;
            cursor$.segment                 = oldSegment;

            if (!validateOnly) {
                invariant(!!layout, "%s must be a valid layout", layout);
            }
            voiceStaves$[staffIdx].push(layout);
        }

        return _.map(segment, (model, idx, list) => {
            let atEnd = idx + 1 === list.length;
            let staffIdx: number = model.staffIdx;
            invariant(isFinite(model.staffIdx), "%s is not finite", model.staffIdx);

            // Create a voice-staff pair if needed. We'll later merge all the
            // voice staff pairs.
            if (!voiceStaves$[staffIdx]) {
                voiceStaves$[staffIdx] = [];
                staffContexts$[staffIdx] = {
                    accidentals$:       {},
                    attributes:         spec.attributes,
                    totalDivisions:     NaN,
                    previous:           null,
                    idx:                staffIdx
                };

                staffLayouts$[staffIdx] = staffLayouts$[staffIdx] || [];
                staffLayouts$[staffIdx].push(voiceStaves$[staffIdx]);
                divisionPerStaff$[staffIdx] = 0;
            }

            cursor$.staff = staffContexts$[staffIdx];

            do {
                if (divisionPerStaff$[staffIdx] <= cursor$.division$) {
                    // Process a staff model within a voice context.
                    let nextStaffEl = staffMeasure[staffIdx][voiceStaves$[staffIdx].length];
                    pushStaffSegment(staffIdx, nextStaffEl);
                } else {
                    break;
                }
            } while (true);

            // All layout that can be controlled by the model is done here.
            let layout: IModel.ILayout;
            if (validateOnly) {
                model.staffIdx = cursor$.staff.idx;
                model.validate$(cursor$);
            } else {
                layout = model.layout(cursor$);
            }
            cursor$.division$ += model.divCount;
            cursor$.prev$ = model;

            if (atEnd) {
                _.forEach(staffMeasure,(staff, idx) => {
                    let voiceStaff = voiceStaves$[<any>idx];
                    while (!!staff && !!voiceStaff && voiceStaves$[<any>idx].length < staff.length) {
                        pushStaffSegment(parseInt(idx, 10), staff[voiceStaves$[<any> idx].length]);
                    }
                });
            }
            lastAttribs = cursor$.staff.attributes;
            maxXInMeasure = Math.max(cursor$.x$, maxXInMeasure);
            maxPaddingTopInMeasure$ = Math.max(cursor$.maxPaddingTop$, maxPaddingTopInMeasure$);
            maxPaddingBottomInMeasure$ = Math.max(
                cursor$.maxPaddingBottom$,
                maxPaddingBottomInMeasure$);
            return layout;
        });
    });

    // Get an ideal voice layout for each voice-staff combination
    let staffLayoutsUnkeyed$: IModel.ILayout[][][] = _.values(staffLayouts$);
    let staffLayoutsCombined: IModel.ILayout[][] = <any> _.flatten(staffLayoutsUnkeyed$);

    // Create a layout that satisfies the constraints in every single voice.
    // IModel.merge$ requires two passes to fully merge the layouts. We do the second pass
    // once we filter unneeded staff segments.
    let allLayouts$ = voiceLayouts$.concat(staffLayoutsCombined);

    // We have a staff layout for every single voice-staff combination.
    // They will be merged, so it doesn't matter which one we pick.
    // Pick the first.
    let staffLayoutsUnique$ = _.map(staffLayoutsUnkeyed$, layouts => layouts[0]);

    if (!spec._noAlign) {
        // Calculate and finish applying the master layout.
        // Two passes is always sufficient.
        let masterLayout = _.reduce(allLayouts$, IModel.merge$, []);
        _.reduce(voiceLayouts$, IModel.merge$, masterLayout);

        // Merge in the staves
        _.reduce(staffLayoutsUnique$, IModel.merge$, masterLayout);
    }

    return {
        attributes: lastAttribs,
        elements: voiceLayouts$.concat(staffLayoutsUnique$),
        width: maxXInMeasure - measure.x,
        paddingTop: maxPaddingTopInMeasure$,
        paddingBottom: maxPaddingBottomInMeasure$
    };
}

module _processMeasure {
    export interface ILayoutOpts {
        segments: Measure.ISegment[];
        measure: Ctx.IMeasure;
        line: Ctx.ILine;
        prevByStaff: IModel[];
        factory: IModel.IFactory;
        attributes: MusicXML.Attributes;

        _noAlign?: boolean;
        _approximate?: boolean;
        _detached?: boolean;
        _validateOnly?: boolean;
    }
}

export = _processMeasure;
