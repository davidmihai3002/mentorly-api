export interface MentorSearchItemDto {
  mentorId: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  domainName: string | null;
  perSessionPriceBani: number | null;
  monthlyPriceBani: number | null;
  rating: number | null;
  reviewCount: number;
  hasTest: boolean;
  sponsorName: string | null;
}

export interface MentorSearchResponseDto {
  items: MentorSearchItemDto[];
  page: number;
  pageSize: number;
  total: number;
}
