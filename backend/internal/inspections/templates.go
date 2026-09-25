package inspections

import (
	"fmt"
	"strings"
)

// PropertyConfig describes the structural profile of a unit used to derive a
// room/item checklist that actually matches the property. A 1 BHK unit should
// not scaffold "Bedroom 2" or "Bathroom 2", and an unfurnished unit should not
// list furniture that is not there.
type PropertyConfig struct {
	Bedrooms  int
	Bathrooms int
	Furnished bool
}

type roomDef struct {
	name  string
	items []string
}

func livingRoomItems(furnished bool) []string {
	if !furnished {
		return []string{"TV Unit", "Ceiling Lights", "Flooring", "Electrical Sockets", "Walls & Paint"}
	}
	return []string{"Sofa", "TV Unit", "Dining Table", "Ceiling Lights", "Curtains", "Flooring", "Electrical Sockets", "Walls & Paint"}
}

func bedroomItems(furnished bool) []string {
	if !furnished {
		return []string{"Ceiling Fan", "Window & Grills", "Flooring", "Walls & Paint"}
	}
	return []string{"Bed", "Mattress", "Wardrobe", "Study Table", "Air Conditioner", "Ceiling Fan", "Window & Grills", "Flooring", "Walls & Paint"}
}

var bathroomItems = []string{"Wash Basin", "WC & Seat", "Shower / Tap", "Geyser", "Exhaust Fan", "Tiles", "Bathroom Fittings"}

var kitchenItems = []string{"Kitchen Sink", "Kitchen Platforms", "Chimney", "Water Purifier", "Gas Stove", "Cupboards", "Tiles & Walls"}

var balconyItems = []string{"Balcony Railing", "Flooring", "Grills"}

var commonItems = []string{"Entrance Door", "Main Door Lock", "Intercom", "Interior Painting", "Balcony Door"}

var departureExtras = []struct {
	name  string
	items []string
}{
	{"Departure Checklist", []string{"Keys Returned", "Utilities Final Reading", "Condition of Painted Walls", "Furniture Condition", "Fixtures & Fittings", "Rubbish Removed"}},
}

// propertyRooms returns the rooms that match the unit profile: one bedroom row
// per bedroom, one bathroom row per bathroom, plus the rooms every unit has.
func propertyRooms(cfg PropertyConfig) []roomDef {
	defs := []roomDef{{"Living Room", livingRoomItems(cfg.Furnished)}}

	bedrooms := cfg.Bedrooms
	if bedrooms < 1 {
		bedrooms = 1
	}
	for i := 1; i <= bedrooms; i++ {
		defs = append(defs, roomDef{fmt.Sprintf("Bedroom %d", i), bedroomItems(cfg.Furnished)})
	}

	defs = append(defs, roomDef{"Kitchen", kitchenItems})

	bathrooms := cfg.Bathrooms
	if bathrooms < 1 {
		bathrooms = 1
	}
	for i := 1; i <= bathrooms; i++ {
		defs = append(defs, roomDef{fmt.Sprintf("Bathroom %d", i), bathroomItems})
	}

	defs = append(defs, roomDef{"Balcony", balconyItems})
	defs = append(defs, roomDef{"Common Areas", commonItems})
	return defs
}

// buildTemplate scaffolds the inspection rooms for a unit based on its
// property profile, skipping any room the user explicitly excludes and
// appending any extra room names they provide.
func buildTemplate(cfg PropertyConfig, others, excluded []string) []Room {
	skip := map[string]struct{}{}
	for _, e := range excluded {
		e = strings.TrimSpace(e)
		if e != "" {
			skip[e] = struct{}{}
		}
	}

	rooms := []Room{}
	order := 0
	add := func(name string, items []string) {
		name = strings.TrimSpace(name)
		if name == "" {
			return
		}
		if _, drop := skip[name]; drop {
			return
		}
		room := Room{Name: name, SortOrder: order}
		for _, itemName := range items {
			room.Items = append(room.Items, Item{Name: itemName})
		}
		rooms = append(rooms, room)
		order++
	}

	for _, d := range propertyRooms(cfg) {
		add(d.name, d.items)
	}
	for _, name := range others {
		add(name, nil)
	}
	return rooms
}

func departureTemplate() []Room {
	rooms := []Room{}
	order := 100
	for _, r := range departureExtras {
		room := Room{Name: r.name, SortOrder: order}
		for _, name := range r.items {
			room.Items = append(room.Items, Item{Name: name})
		}
		rooms = append(rooms, room)
		order++
	}
	return rooms
}

// defaultConfig returns a sane profile when fields are unset.
func (c PropertyConfig) normalize() PropertyConfig {
	if c.Bedrooms < 1 {
		c.Bedrooms = 1
	}
	if c.Bathrooms < 1 {
		c.Bathrooms = 1
	}
	return c
}