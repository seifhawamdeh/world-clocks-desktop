UUID = worldclocks@seifhawamdeh.github.io
EXT_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

.PHONY: pack install enable disable prefs clean

pack:
	glib-compile-schemas schemas/
	gnome-extensions pack . \
		--extra-source=stylesheet.css \
		--force

install:
	mkdir -p $(EXT_DIR)/schemas
	cp metadata.json extension.js prefs.js stylesheet.css $(EXT_DIR)/
	cp schemas/*.gschema.xml $(EXT_DIR)/schemas/
	glib-compile-schemas $(EXT_DIR)/schemas/
	@echo "Installed. Log out and back in, then: make enable"

enable:
	gnome-extensions enable $(UUID)

disable:
	gnome-extensions disable $(UUID)

prefs:
	gnome-extensions prefs $(UUID)

clean:
	rm -f schemas/gschemas.compiled *.shell-extension.zip
