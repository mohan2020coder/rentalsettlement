
Issue in Screen: move in inspection screen and move out inspection screen( it displays all the rooms and items ,  1 bhk or 2 bhk it is same but why should tenant of 1 bhk get all the list), and the photo and video upload for rooms and items are not available. i think the interface need more user friendly - clickable room with selectable items and photos to upload more flexible than being fixed with all the itmes and rooms for all the property type. need a distint way to find the type and list the rooms and items. moreover the inspection of the images and slectable should be neatly viewable for both tenant and landloard.


Issue in Screen: Discover scrren in tenant login - property is listed in the marketplace even when it is in the tenancy, if already a user is active in the tenancy it should not show to other users. listing of that will give 
mispresentation of the property.

Issue in Screen: home screen in tenant login - two cards - one with my rental and one with active is displaying same 
things except the format of displaying 



Issue in Screen: Updates -  it is more geniric , why should a user see something like this in the first place
it looks like inapp notification but 


Issue in the Rental agreement screen: why the view all  versions is not working correctly

Issue in Deduction claim screen: unable to add evidence in deduction claim

Issue: bottom menu (tab bar) is not displaying in some screens (detail screens hide the tab bar)

Issue: rental terms is not displayed when the tenant accepts the invite — only an accept/approve action is displayed

Issue: when move-in is selected with the rooms, move-out again asks for the room selection instead of reusing the same room list

---

## Resolution status

1. **Inspection screens** — Fixed. Room/item checklist is now generated from the property type (Bedrooms/Bathrooms/Furnishing) via a new template endpoint (`GET /inspections/tenancy/:tenancyID/template`); tenants can unselect rooms (`exclude_rooms`) and add their own rooms/notes at creation; photo and video upload is available per room and per item on the move-in/move-out detail screens with an inline gallery for viewing.
2. **Discover marketplace listing** — Fixed. Customers no longer see properties that have an occupying tenancy (INVITED/ACTIVE/NOTICE_GIVEN/MOVE_OUT) listed in the marketplace.
3. **Home tenant duplicate cards** — Fixed. The redundant "Active tenancy" summary card was removed; deposit and rent are now shown together in the hero card.
4. **Updates tab** — Improved. Empty/read states now have meaningful copy, type chips are humanized, and openable updates (applications, tenancies, inspections) navigate to the relevant screen.
5. **Rental agreement "View all versions"** — Fixed. The button now actually expands/collapses the version history (past 3 collapsed by default) and each version can be expanded inline to see its terms.
6. **Deduction claims evidence** — Fixed. Claims now support attachments: the claim detail screen has an "Add evidence" button that photo/video-uploads to storage and attaches metadata (`POST /deductions/:id/media`), shows a thumbnail grid with image preview/video playback, and allows removal (`DELETE /deductions/:id/media/:mediaID`). Backed by a new `deduction_claim_evidence` table (migration 0012) plus audit tracking; generated PDFs list attachment counts.
7. **Bottom menu hidden on detail screens** — Fixed. Detail screens were being pushed on the root stack, which covered the tab bar. Navigation is refactored so each tab hosts its own nested stack (`HomeTabStack`, `DiscoverTabStack`, `PropertiesTabStack`); detail screens now sit inside the tabs so the bottom menu stays visible. Cross-tab routes use nested navigation (e.g. opening a tenancy from a property switches to the Home tab), and the open action in the Updates tab now routes to the owning tab.
8. **Rental terms not shown on invite accept** — Fixed. Pending invitation cards on Home are now expandable: tapping the card reveals the terms (monthly rent, security deposit, term dates, notice period, rent due day) together with Accept/Decline buttons, so a tenant reviews the terms before accepting.
9. **Move-out re-asking for rooms** — Fixed. When a move-in inspection exists, the move-out screen now reuses the same room checklist (read-only list of the move-in rooms) plus the departure extras (Cleaning, Walls and fixtures, Fixtures and fittings); the backend template endpoint returns `reused_from_move_in` so the tenant no longer re-selects rooms.cls
10. PropertyDetailScreen computes the stage per tenancy: it defaults to the occupying tenancy (INVITED/ACTIVE/NOTICE_GIVEN/MOVE_OUT), falling back to the most recent one. With multiple rentals a "Rental history" chip row appears (dates + status per tenancy); tapping a chip switches the stage card and journey timeline. Stage copy is tenancy-scoped.
11. **Rental terms renewal/update unavailable for active tenancies** — Fixed. The backend already supported drafting a new version (`POST /agreements/tenancy/:id/versions`, allowed for ACTIVE/NOTICE_GIVEN/MOVE_OUT/INVITED, notifying the other party), but the app had no UI for it. A landlord-scoped "Renew / update terms" button on the Agreement screen opens a new "Renew terms" form pre-filled from the current terms (rent, deposit, rent due day, notice period, late fee, utility inclusions, clauses). Submitting creates the next agreement version and notifies the tenant, who confirms it from the Updates tab; the current terms and version history reload on focus so the new version appears immediately.
12. **Back button missing when opening a property from a tenancy (tenant login)** — Fixed. Cross-tab navigation used two separate dispatches (switch tab, then push the nested screen). For a lazily-loaded tab the nested screen race became that tab's root screen, leaving nothing to go back to. Fix: tabs are now eagerly mounted (`lazy: false` on the bottom tab navigator) so every tab's stack always contains its root screen, and `openTabScreen` performs the canonical single nested navigation (`navigate(tab, { screen, params })`). A back button is now always present when opening a property from the tenant's tenancy detail screen.

issued fixed on 25-09-2026
------------------------------------------------------------------------------------------------