package inspections

// Standard room/item templates used to scaffold inspections. Tenants and
// landlords can adjust items during the draft phase.

var defaultRooms = []struct {
	name  string
	items []string
}{
	{"Living Room", []string{"Sofa", "TV Unit", "Dining Table", "Ceiling Lights", "Curtains", "Flooring", "Electrical Sockets", "Walls & Paint"}},
	{"Bedroom 1", []string{"Bed", "Mattress", "Wardrobe", "Study Table", "Air Conditioner", "Ceiling Fan", "Window & Grills", "Flooring"}},
	{"Bedroom 2", []string{"Bed", "Mattress", "Wardrobe", "Ceiling Fan", "Window & Grills", "Flooring"}},
	{"Kitchen", []string{"Kitchen Sink", "Kitchen Platforms", "Chimney", "Water Purifier", "Gas Stove", "Cupboards", "Tiles & Walls"}},
	{"Bathroom 1", []string{"Wash Basin", "WC & Seat", "Shower / Tap", "Geyser", "Exhaust Fan", "Tiles", "Bathroom Fittings"}},
	{"Bathroom 2", []string{"Wash Basin", "WC & Seat", "Shower / Tap", "Geyser", "Exhaust Fan", "Tiles", "Bathroom Fittings"}},
	{"Balcony", []string{"Balcony Railing", "Flooring", "Grills"}},
	{"Common Areas", []string{"Entrance Door", "Main Door Lock", "Intercom", "Interior Painting", "Balcony Door"}},
}

var departureExtras = []struct {
	name  string
	items []string
}{
	{"Departure Checklist", []string{"Keys Returned", "Utilities Final Reading", "Condition of Painted Walls", "Furniture Condition", "Fixtures & Fittings", "Rubbish Removed"}},
}

func buildTemplate(others []string) []Room {
	rooms := []Room{}
	order := 0
	for _, r := range defaultRooms {
		room := Room{Name: r.name, SortOrder: order}
		for _, name := range r.items {
			room.Items = append(room.Items, Item{Name: name})
		}
		rooms = append(rooms, room)
		order++
	}
	for _, name := range others {
		rooms = append(rooms, Room{Name: name, SortOrder: order})
		order++
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
