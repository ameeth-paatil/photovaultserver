import { Injectable } from '@nestjs/common';
import { Insertable, Kysely, sql, Updateable } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import { DummyValue, GenerateSql } from 'src/decorators';
import { LibraryStatsResponseDto } from 'src/dtos/library.dto';
import { AssetType, AssetVisibility } from 'src/enum';
import { DB } from 'src/schema';
import { LibraryTable } from 'src/schema/tables/library.table';

export enum AssetSyncResult {
  DO_NOTHING,
  UPDATE,
  OFFLINE,
  CHECK_OFFLINE,
}

@Injectable()
export class LibraryRepository {
  constructor(@InjectKysely() private db: Kysely<DB>) {}

  @GenerateSql({ params: [DummyValue.UUID] })
  get(id: string, withDeleted = false) {
    return this.db
      .selectFrom('libraries')
      .selectAll('libraries')
      .where('libraries.id', '=', id)
      .$if(!withDeleted, (qb) => qb.where('libraries.deletedAt', 'is', null))
      .executeTakeFirst();
  }

  @GenerateSql({ params: [] })
  getAll(withDeleted = false) {
    return this.db
      .selectFrom('libraries')
      .selectAll('libraries')
      .orderBy('createdAt', 'asc')
      .$if(!withDeleted, (qb) => qb.where('libraries.deletedAt', 'is', null))
      .execute();
  }

  @GenerateSql()
  getAllDeleted() {
    return this.db
      .selectFrom('libraries')
      .selectAll('libraries')
      .where('libraries.deletedAt', 'is not', null)
      .orderBy('createdAt', 'asc')
      .execute();
  }

  create(library: Insertable<LibraryTable>) {
    return this.db.insertInto('libraries').values(library).returningAll().executeTakeFirstOrThrow();
  }

  async delete(id: string) {
    await this.db.deleteFrom('libraries').where('libraries.id', '=', id).execute();
  }

  async softDelete(id: string) {
    await this.db.updateTable('libraries').set({ deletedAt: new Date() }).where('libraries.id', '=', id).execute();
  }

  update(id: string, library: Updateable<LibraryTable>) {
    return this.db
      .updateTable('libraries')
      .set(library)
      .where('libraries.id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  @GenerateSql({ params: [DummyValue.UUID] })
  async getStatistics(id: string): Promise<LibraryStatsResponseDto | undefined> {
    const stats = await this.db
      .selectFrom('libraries')
      .innerJoin('assets', 'assets.libraryId', 'libraries.id')
      .leftJoin('exif', 'exif.assetId', 'assets.id')
      .select((eb) =>
        eb.fn
          .countAll<number>()
          .filterWhere((eb) =>
            eb.and([eb('assets.type', '=', AssetType.IMAGE), eb('assets.visibility', '!=', AssetVisibility.HIDDEN)]),
          )
          .as('photos'),
      )
      .select((eb) =>
        eb.fn
          .countAll<number>()
          .filterWhere((eb) =>
            eb.and([eb('assets.type', '=', AssetType.VIDEO), eb('assets.visibility', '!=', AssetVisibility.HIDDEN)]),
          )
          .as('videos'),
      )
      .select((eb) => eb.fn.coalesce((eb) => eb.fn.sum('exif.fileSizeInByte'), eb.val(0)).as('usage'))
      .groupBy('libraries.id')
      .where('libraries.id', '=', id)
      .executeTakeFirst();

    // possibly a new library with 0 assets
    if (!stats) {
      const zero = sql<number>`0::int`;
      return this.db
        .selectFrom('libraries')
        .select(zero.as('photos'))
        .select(zero.as('videos'))
        .select(zero.as('usage'))
        .select(zero.as('total'))
        .where('libraries.id', '=', id)
        .executeTakeFirst();
    }

    return {
      photos: stats.photos,
      videos: stats.videos,
      usage: stats.usage,
      total: stats.photos + stats.videos,
    };
  }

  streamAssetIds(libraryId: string) {
    return this.db.selectFrom('assets').select(['id']).where('libraryId', '=', libraryId).stream();
  }
}
