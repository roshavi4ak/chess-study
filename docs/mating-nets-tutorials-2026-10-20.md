# Mating nets and defensive branches

Expanded the queen, rook, two-bishop and bishop-and-knight tutorials. Every mating diagram now shows the defending king's legal one-square escapes and names the pieces that prevent each other neighbouring move. The map uses legal moves even on White-to-move teaching snapshots, and accounts for sliding-piece attacks uncovered when Black vacates its current square. Text and colour distinguish a completed mating net from stalemate or a position with several defenses.

Eight new teaching scenes and five selectable defensive branches cover:

- Queen: preserve the file/rank box while advancing the king; tighten only when safe; respond to retreat or movement towards h6 without releasing the fifth-rank wall or hanging the queen.
- Rook: add a protected rank barrier to a file barrier; follow a change of direction while keeping the rook protected and bringing the king closer.
- Two bishops: bring the king between the diagonal barriers; shift the other bishop when Black chooses the other side; rebuild the net on either side of the board.
- Bishop and knight: meet the actual ...Kg7 escape, rebuild a genuine net, transfer control to the bishop before moving the knight, adapt to a central escape, and answer ...Ke8 after Nc5 with Nd7 and the appropriate king maneuver.

Selecting a defensive branch resets only that example's board and move counter. Moving backwards or changing lessons restores the correct explanation and position. Every intermediate move of each mating line has English and Bulgarian explanation text. The escape map is visible by default and its board highlights can be toggled. Tutorials remain read-only and do not save student attempts or request engine advice.

Authoring verification: 40 examples/branches, 165 displayed boards and 143 unique positions checked against the Lichess tablebase. The checked-in proof contains every legal alternative for each position. Offline checks assert winning outcomes against all defenses, safe material, legal moves, intended terminal results, accurate escape-square attribution, and complete translations. Component regressions cover both languages, all branches, reset/backward navigation and highlight controls.

Deployment: isolated VPS build with the current production dependencies, full regression suite, lint, production type/build checks, staged and live smoke tests, and an application-only restart with rollback. No schema or student-data changes are needed.
