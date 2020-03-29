import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity()
export class User {
	@PrimaryColumn()
	id: string = '';

	@Column()
	name: string = '';

	@Column()
	email: string = '';

	@Column()
	isAdmin: boolean = false;
}
