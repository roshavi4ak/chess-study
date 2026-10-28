// Compare the ratings before either rating is updated. Rating uncertainty and
// account age must never affect competition points.
export function puzzleChallengePoints(studentRating: number, puzzleRating: number): number {
    const difference = puzzleRating - studentRating;
    if (difference < -400) return 0;
    if (difference < -200) return 5;
    if (difference <= 200) return 10;
    return 15;
}
