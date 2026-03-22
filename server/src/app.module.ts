import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '../.env',
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.SUPABASE_DB_TRX_POOLER,
      autoLoadEntities: true,
      synchronize: true,
      ssl: {
        rejectUnauthorized: false, // Required for Supabase connections
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
