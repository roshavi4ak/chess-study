export interface RatingData {
  rating: number;
  rd: number;
  volatility: number;
}

export interface MatchResult {
  opponentRating: number;
  opponentRd: number;
  score: number; // 1 for win, 0 for loss, 0.5 for draw
}

export class Glicko2 {
  // System constant TAU which constrains the change in volatility over time.
  // Reasonable choices are between 0.3 and 1.2. Lichess often uses 0.5.
  private static readonly TAU = 0.5;
  private static readonly SCALE = 173.7178;
  private static readonly EPSILON = 0.000001;

  // Convert rating to Glicko-2 scale
  private static toGlicko2Scale(rating: number, rd: number): { mu: number; phi: number } {
    return {
      mu: (rating - 1500) / this.SCALE,
      phi: rd / this.SCALE,
    };
  }

  // Convert from Glicko-2 scale to original scale
  private static fromGlicko2Scale(mu: number, phi: number): { rating: number; rd: number } {
    return {
      rating: this.SCALE * mu + 1500,
      rd: this.SCALE * phi,
    };
  }

  private static g(phi: number): number {
    return 1 / Math.sqrt(1 + 3 * phi * phi / (Math.PI * Math.PI));
  }

  private static E(mu: number, mu_j: number, phi_j: number): number {
    return 1 / (1 + Math.exp(-this.g(phi_j) * (mu - mu_j)));
  }

  /**
   * Calculates the new rating, RD, and volatility after a set of matches.
   * For puzzles, this will typically be a single match against the puzzle.
   */
  public static calculateNewRating(
    player: RatingData,
    results: MatchResult[]
  ): RatingData {
    // Step 2: Convert to Glicko-2 scale
    const playerG2 = this.toGlicko2Scale(player.rating, player.rd);
    const mu = playerG2.mu;
    const phi = playerG2.phi;
    const sigma = player.volatility;

    // Step 3: Compute the quantity v (estimated variance) and delta
    let v_inv = 0;
    let delta_sum = 0;

    for (const result of results) {
       const opponentG2 = this.toGlicko2Scale(result.opponentRating, result.opponentRd);
       const mu_j = opponentG2.mu;
       const phi_j = opponentG2.phi;
       const g_phi_j = this.g(phi_j);
       const E_val = this.E(mu, mu_j, phi_j);

       v_inv += g_phi_j * g_phi_j * E_val * (1 - E_val);
       delta_sum += g_phi_j * (result.score - E_val);
    }
    
    // If no games played, rating doesn't change, only RD increases (Step 6 handles this if we skip to it, but standard algo assumes games)
    if (results.length === 0) {
        // Just increase RD
        // Step 6 for no games:
        const phi_star = Math.sqrt(phi * phi + sigma * sigma);
        const newRating = this.fromGlicko2Scale(mu, phi_star);
        return {
            rating: newRating.rating,
            rd: newRating.rd,
            volatility: sigma
        };
    }

    const v = 1 / v_inv;
    const delta = v * delta_sum;

    // Step 5: Determine the new volatility, sigma'
    const a = Math.log(sigma * sigma);
    
    const f = (x: number): number => {
      const exp_x = Math.exp(x);
      const A = exp_x * (delta * delta - phi * phi - v - exp_x);
      const B = 2 * Math.pow(phi * phi + v + exp_x, 2);
      const C = (x - a) / (this.TAU * this.TAU);
      return (A / B) - C;
    };

    let A = a;
    let B: number;
    if (delta * delta > phi * phi + v) {
      B = Math.log(delta * delta - phi * phi - v);
    } else {
      let k = 1;
      while (f(a - k * this.TAU) < 0) {
        k++;
      }
      B = a - k * this.TAU;
    }

    let fA = f(A);
    let fB = f(B);

    while (Math.abs(B - A) > this.EPSILON) {
      const C = A + (A - B) * fA / (fB - fA);
      const fC = f(C);

      if (fC * fB < 0) {
        A = B;
        fA = fB;
      } else {
        fA = fA / 2;
      }
      
      B = C;
      fB = fC;
    }

    const newSigma = Math.exp(A / 2);

    // Step 6: Update the rating deviation to the new pre-rating period value, phi*
    const phi_star = Math.sqrt(phi * phi + newSigma * newSigma);

    // Step 7: Update the rating and RD to the new values, mu' and phi'
    const newPhi = 1 / Math.sqrt(1 / (phi_star * phi_star) + 1 / v);
    const newMu = mu + newPhi * newPhi * delta_sum; // Note: delta_sum is (sum g(phi_j)(s_j - E)), and formula is mu' = mu + phi'^2 * sum(...)

    // Step 8: Convert ratings and RD back to original scale
    const finalRating = this.fromGlicko2Scale(newMu, newPhi);

    return {
      rating: finalRating.rating,
      rd: finalRating.rd,
      volatility: newSigma,
    };
  }
}
