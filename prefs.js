import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class WorldClocksPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage();
        window.add(page);

        const clocksGroup = new Adw.PreferencesGroup({ title: 'Clocks' });
        page.add(clocksGroup);

        const listBox = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.NONE,
            css_classes: ['boxed-list'],
        });
        clocksGroup.add(listBox);

        const rows = [];

        const save = () => {
            const values = rows.map(r => {
                if (r.sep)
                    return '---';
                return `${r.city.get_text().trim()}|${r.tz.get_text().trim()}`;
            }).filter(v => v === '---' || (v !== '|' && !v.startsWith('|') && !v.endsWith('|')));
            settings.set_strv('clocks', values);
        };

        const removeRow = (row, entry) => {
            listBox.remove(row);
            const idx = rows.findIndex(r => r === entry);
            if (idx !== -1)
                rows.splice(idx, 1);
            save();
        };

        const addRow = (city = '', tz = '') => {
            const row = new Adw.ActionRow();
            const cityEntry = new Gtk.Entry({
                text: city, placeholder_text: 'City name', hexpand: true,
            });
            const tzEntry = new Gtk.Entry({
                text: tz, placeholder_text: 'Region/City e.g. Asia/Tokyo', hexpand: true,
            });
            const removeButton = new Gtk.Button({
                icon_name: 'user-trash-symbolic', valign: Gtk.Align.CENTER,
            });

            const entry = { sep: false, city: cityEntry, tz: tzEntry };
            cityEntry.connect('changed', save);
            tzEntry.connect('changed', save);
            removeButton.connect('clicked', () => removeRow(row, entry));

            const box = new Gtk.Box({ spacing: 6, margin_top: 6, margin_bottom: 6, margin_start: 6, margin_end: 6 });
            box.append(cityEntry);
            box.append(tzEntry);
            box.append(removeButton);
            row.set_child(box);

            listBox.append(row);
            rows.push(entry);
        };

        const addDivider = () => {
            const row = new Adw.ActionRow({ title: '──  Divider  ──' });
            const removeButton = new Gtk.Button({
                icon_name: 'user-trash-symbolic', valign: Gtk.Align.CENTER,
            });
            const entry = { sep: true };
            removeButton.connect('clicked', () => removeRow(row, entry));
            row.add_suffix(removeButton);

            listBox.append(row);
            rows.push(entry);
        };

        for (const raw of settings.get_strv('clocks')) {
            const parts = raw.split('|');
            if (parts.length !== 2)
                addDivider();
            else
                addRow(parts[0], parts[1]);
        }

        const buttonBox = new Gtk.Box({ spacing: 8, margin_top: 12, halign: Gtk.Align.START });
        const addButton = new Gtk.Button({ label: 'Add clock' });
        addButton.connect('clicked', () => addRow());
        const addDividerButton = new Gtk.Button({ label: 'Add divider' });
        addDividerButton.connect('clicked', () => {
            addDivider();
            save();
        });
        buttonBox.append(addButton);
        buttonBox.append(addDividerButton);
        clocksGroup.add(buttonBox);

        const styleGroup = new Adw.PreferencesGroup({ title: 'Appearance' });
        page.add(styleGroup);

        const modes = ['digital', 'analog'];
        const modeLabels = Gtk.StringList.new(['Digital', 'Analog']);
        const modeRow = new Adw.ComboRow({
            title: 'Clock style',
            model: modeLabels,
        });
        modeRow.selected = Math.max(0, modes.indexOf(settings.get_string('mode')));
        modeRow.connect('notify::selected', () =>
            settings.set_string('mode', modes[modeRow.selected]));
        styleGroup.add(modeRow);

        const layers = ['desktop', 'overlay'];
        const layerRow = new Adw.ComboRow({
            title: 'Layer',
            subtitle: 'Desktop shows behind windows; overlay stays on top',
            model: Gtk.StringList.new(['Desktop (behind windows)', 'Overlay (always on top)']),
        });
        layerRow.selected = Math.max(0, layers.indexOf(settings.get_string('layer')));
        layerRow.connect('notify::selected', () =>
            settings.set_string('layer', layers[layerRow.selected]));
        styleGroup.add(layerRow);

        const posGroup = new Adw.PreferencesGroup({ title: 'Position' });
        page.add(posGroup);

        const anchors = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
        const anchorRow = new Adw.ComboRow({
            title: 'Anchor corner',
            model: Gtk.StringList.new(anchors),
        });
        anchorRow.selected = Math.max(0, anchors.indexOf(settings.get_string('anchor')));
        anchorRow.connect('notify::selected', () =>
            settings.set_string('anchor', anchors[anchorRow.selected]));
        posGroup.add(anchorRow);

        const marginXRow = new Adw.SpinRow({
            title: 'Horizontal margin (px)',
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 2000, step_increment: 10 }),
        });
        marginXRow.value = settings.get_int('margin-x');
        marginXRow.connect('notify::value', () => settings.set_int('margin-x', marginXRow.value));
        posGroup.add(marginXRow);

        const marginYRow = new Adw.SpinRow({
            title: 'Vertical margin (px)',
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 2000, step_increment: 10 }),
        });
        marginYRow.value = settings.get_int('margin-y');
        marginYRow.connect('notify::value', () => settings.set_int('margin-y', marginYRow.value));
        posGroup.add(marginYRow);
    }
}
