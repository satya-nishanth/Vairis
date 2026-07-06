type RatingProps = {
  score?: string;
  reviews?: string;
  className?: string;
};

export function Rating({ score = "4.9", reviews, className }: RatingProps) {
  return (
    <span className={["rating", className].filter(Boolean).join(" ")}>
      <span className="rating__stars">★★★★★</span> {score}
      {reviews && ` (${reviews})`}
    </span>
  );
}
