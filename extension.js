import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const DEFAULT_CLOCKS = [
    ['Riyadh', 'Asia/Riyadh'],
    ['Dubai', 'Asia/Dubai'],
    ['Bangalore', 'Asia/Kolkata'],
    ['New York', 'America/New_York'],
    ['Los Angeles', 'America/Los_Angeles'],
];

export default class WorldClocksExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._clocks = [];

        // Root card container.
        this._card = new St.BoxLayout({
            vertical: true,
            style_class: 'wc-card',
            reactive: false,
            x_expand: false,
            y_expand: false,
        });

        this._title = new St.Label({
            text: 'World Clocks',
            style_class: 'wc-title',
        });
        this._card.add_child(this._title);

        this._rowsBox = new St.BoxLayout({
            vertical: true,
            style_class: 'wc-rows',
        });
        this._card.add_child(this._rowsBox);

        this._rebuildClocks();

        this._addToStage();
        this._placeWidget();

        this._monitorsChangedId = Main.layoutManager.connect(
            'monitors-changed', () => this._placeWidget());
        this._workareasChangedId = global.display.connect(
            'workareas-changed', () => this._placeWidget());
        // Reposition whenever the card is re-measured (font/content changes).
        this._notifySizeId = this._card.connect(
            'notify::width', () => this._placeWidget());

        this._settingsChangedId = this._settings.connect(
            'changed::clocks', () => this._rebuildClocks());
        this._modeChangedId = this._settings.connect(
            'changed::mode', () => this._rebuildClocks());
        this._layerChangedId = this._settings.connect(
            'changed::layer', () => {
                this._removeFromStage();
                this._addToStage();
                this._placeWidget();
            });
        this._marginChangedId = this._settings.connect(
            'changed::margin-x', () => this._placeWidget());
        this._marginYChangedId = this._settings.connect(
            'changed::margin-y', () => this._placeWidget());
        this._anchorChangedId = this._settings.connect(
            'changed::anchor', () => this._placeWidget());

        this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            this._updateClocks();
            return GLib.SOURCE_CONTINUE;
        });
        this._updateClocks();
    }

    disable() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = null;
        }
        if (this._monitorsChangedId) {
            Main.layoutManager.disconnect(this._monitorsChangedId);
            this._monitorsChangedId = null;
        }
        if (this._workareasChangedId) {
            global.display.disconnect(this._workareasChangedId);
            this._workareasChangedId = null;
        }
        for (const id of [
            this._settingsChangedId, this._marginChangedId,
            this._marginYChangedId, this._anchorChangedId, this._modeChangedId,
            this._layerChangedId,
        ]) {
            if (id)
                this._settings.disconnect(id);
        }
        this._settingsChangedId = null;
        this._marginChangedId = null;
        this._marginYChangedId = null;
        this._anchorChangedId = null;
        this._modeChangedId = null;
        this._layerChangedId = null;

        if (this._card) {
            if (this._notifySizeId) {
                this._card.disconnect(this._notifySizeId);
                this._notifySizeId = null;
            }
            this._removeFromStage();
            this._card.destroy();
            this._card = null;
        }
        this._clocks = [];
        this._settings = null;
    }

    // Places the card either behind windows (desktop layer, only visible on the
    // desktop) or above them (overlay / always-on-top). Overlay uses the public
    // addChrome() API; desktop uses the background group.
    _addToStage() {
        const layer = this._settings.get_string('layer');
        if (layer === 'overlay') {
            Main.layoutManager.addChrome(this._card);
        } else {
            Main.layoutManager._backgroundGroup.add_child(this._card);
        }
        this._currentLayer = layer;
    }

    _removeFromStage() {
        if (!this._card)
            return;
        if (this._currentLayer === 'overlay') {
            Main.layoutManager.removeChrome(this._card);
        } else {
            const parent = this._card.get_parent();
            if (parent)
                parent.remove_child(this._card);
        }
        this._currentLayer = null;
    }

    // Returns entries as either { sep: true } or { city, tzid }.
    // A raw entry of "---" (or anything without a "|") is a section divider.
    _getClockList() {
        const raw = this._settings.get_strv('clocks');
        const source = (!raw || raw.length === 0)
            ? DEFAULT_CLOCKS.map(([c, t]) => `${c}|${t}`)
            : raw;

        return source.map(entry => {
            const parts = entry.split('|');
            if (parts.length !== 2)
                return { sep: true };
            return { city: parts[0], tzid: parts[1] };
        });
    }

    _rebuildClocks() {
        this._rowsBox.destroy_all_children();
        this._clocks = [];

        for (const item of this._getClockList()) {
            if (item.sep) {
                this._rowsBox.add_child(new St.Widget({
                    style_class: 'wc-sep',
                    x_expand: true,
                }));
                continue;
            }

            const { city, tzid } = item;
            const analog = this._settings.get_string('mode') === 'analog';
            const row = new St.BoxLayout({ style_class: 'wc-row', x_expand: true });

            const left = new St.BoxLayout({ vertical: true, x_expand: true });
            const cityLabel = new St.Label({ text: city, style_class: 'wc-city' });
            const metaLabel = new St.Label({ text: '', style_class: 'wc-meta' });
            left.add_child(cityLabel);
            left.add_child(metaLabel);
            row.add_child(left);

            if (analog) {
                const dial = new St.DrawingArea({
                    style_class: 'wc-dial',
                    y_align: Clutter.ActorAlign.CENTER,
                });
                dial.connect('repaint', () => this._drawDial(dial, tzid));
                row.add_child(dial);
                this._clocks.push({ tzid, dial, metaLabel });
            } else {
                const timeLabel = new St.Label({ text: '--:--', style_class: 'wc-time' });
                timeLabel.clutter_text.set_x_align(Clutter.ActorAlign.END);
                row.add_child(timeLabel);
                this._clocks.push({ tzid, timeLabel, metaLabel });
            }

            this._rowsBox.add_child(row);
        }

        this._updateClocks();
    }

    _updateClocks() {
        const localNow = GLib.DateTime.new_now_local();
        const localDay = localNow ? localNow.get_day_of_year() : 0;

        for (const { tzid, timeLabel, dial, metaLabel } of this._clocks) {
            const tz = GLib.TimeZone.new(tzid);
            const now = GLib.DateTime.new_now(tz);

            if (dial)
                dial.queue_repaint();

            if (!now) {
                if (timeLabel)
                    timeLabel.set_text('--:--');
                metaLabel.set_text('');
                continue;
            }

            if (timeLabel)
                timeLabel.set_text(now.format('%H:%M'));

            // Day marker relative to local day, plus weekday.
            const dayName = now.format('%a');
            const diff = now.get_day_of_year() - localDay;
            let dayTag = dayName;
            if (diff > 0)
                dayTag = `${dayName} +1`;
            else if (diff < 0)
                dayTag = `${dayName} -1`;
            metaLabel.set_text(dayTag);
        }
    }

    // Draws an analog dial for the given timezone onto a St.DrawingArea.
    _drawDial(area, tzid) {
        const cr = area.get_context();
        const [w, h] = area.get_surface_size();
        if (!cr || w === 0 || h === 0) {
            if (cr)
                cr.$dispose();
            return;
        }

        const cx = w / 2;
        const cy = h / 2;
        const r = Math.min(w, h) / 2 - 2;

        cr.setLineCap(1); // CAIRO_LINE_CAP_ROUND

        // Face.
        cr.setLineWidth(1.5);
        cr.setSourceRGBA(1, 1, 1, 0.85);
        cr.arc(cx, cy, r, 0, 2 * Math.PI);
        cr.stroke();

        // Hour ticks.
        cr.setLineWidth(1);
        cr.setSourceRGBA(1, 1, 1, 0.55);
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * 2 * Math.PI;
            const sin = Math.sin(a);
            const cos = Math.cos(a);
            cr.moveTo(cx + sin * (r - 3), cy - cos * (r - 3));
            cr.lineTo(cx + sin * r, cy - cos * r);
        }
        cr.stroke();

        const tz = GLib.TimeZone.new(tzid);
        const now = GLib.DateTime.new_now(tz);
        if (now) {
            const sec = now.get_second();
            const min = now.get_minute();
            const hour = now.get_hour();

            const hourA = (((hour % 12) + min / 60) / 12) * 2 * Math.PI;
            const minA = ((min + sec / 60) / 60) * 2 * Math.PI;
            const secA = (sec / 60) * 2 * Math.PI;

            const hand = (angle, len, width, rgba) => {
                cr.setLineWidth(width);
                cr.setSourceRGBA(...rgba);
                cr.moveTo(cx, cy);
                cr.lineTo(cx + Math.sin(angle) * len, cy - Math.cos(angle) * len);
                cr.stroke();
            };

            hand(hourA, r * 0.5, 2.2, [1, 1, 1, 0.95]);
            hand(minA, r * 0.78, 1.6, [1, 1, 1, 0.95]);
            hand(secA, r * 0.85, 1, [0.47, 0.78, 1, 0.9]);

            // Center hub.
            cr.setSourceRGBA(1, 1, 1, 1);
            cr.arc(cx, cy, 1.6, 0, 2 * Math.PI);
            cr.fill();
        }

        cr.$dispose();
    }

    _placeWidget() {
        if (!this._card)
            return;
        const monitorIndex = Main.layoutManager.primaryIndex;
        const workArea = Main.layoutManager.getWorkAreaForMonitor(monitorIndex);
        if (!workArea)
            return;

        const marginX = this._settings.get_int('margin-x');
        const marginY = this._settings.get_int('margin-y');
        const anchor = this._settings.get_string('anchor');

        const [, natWidth] = this._card.get_preferred_width(-1);
        const [, natHeight] = this._card.get_preferred_height(-1);

        let x = workArea.x + marginX;
        let y = workArea.y + marginY;

        if (anchor.includes('right'))
            x = workArea.x + workArea.width - natWidth - marginX;
        if (anchor.includes('bottom'))
            y = workArea.y + workArea.height - natHeight - marginY;

        this._card.set_position(Math.round(x), Math.round(y));
    }
}
