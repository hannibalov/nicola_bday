import { jest } from "@jest/globals";

const mockState: { data: any } = { data: null };

export const supabase = {
  from: jest.fn().mockImplementation((_table: string) => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockImplementation(async () => ({
      data: mockState.data,
      error: null,
    })),
    upsert: jest.fn().mockImplementation(async (payload: any) => {
      mockState.data = { data: payload.data };
      return { error: null };
    }),
  })),
};

export function setMockState(data: any) {
  mockState.data = data;
}
