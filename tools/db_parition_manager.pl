#!/usr/bin/perl
# 
# This creates needed partition for high-volume tables, and drops old tables to free up space.
# 

use strict;
use warnings;
use DBI;
use POSIX qw(strftime);

our $conf = {
	database	=>	{
		name     => "muirgen",
		user     => "admin",
		password => "Initial1",
		handle   => "",
		host     => "localhost",
		port     => 5432,
		writes   => [],
	},
	debug		=>	1,
	tables		=>	{
		n2k_traffic		=>	{
			keep_days		=>	3,
			existing_tables 	=>	{},
		},
		motions			=>	{
			keep_days		=>	3,
			existing_tables 	=>	{},
		},
		motors			=>	{
			keep_days		=>	3,
			existing_tables 	=>	{},
		},
		vessel_transmissions	=>	{
			keep_days		=>	3,
			existing_tables 	=>	{},
		},
	}
};

# Try to connect to the database.
db_connect();

foreach my $table_name (sort {$a cmp $b} keys %{$conf->{tables}})
{
	my $keep_days = $conf->{tables}{$table_name}{keep_days};
	print "Processing the table: [".$table_name."], keeping: [".$keep_days."] worth of records.\n";
	
	# Get a list of nrk_traffic* tables.
	get_existing_tables($table_name);
	
	# Make sure the default table exists.
	my $default_table = $table_name."_default";
	if (not exists $conf->{tables}{$table_name}{existing_tables}{$default_table})
	{
		# Create the default table.
		print "Will create the table: '".$default_table."' and set it as the default partition.\n";
		push @{$conf->{database}{writes}}, "CREATE UNLOGGED TABLE ".$default_table." PARTITION OF ".$table_name." DEFAULT;";
	}
	else
	{
		# Delete it from the hash, we'll use left over ones to know what to delete at the end.
		print "The default table: [".$default_table."] exists already.\n";
		delete $conf->{tables}{$table_name}{existing_tables}{$default_table};
	}
	
	# Make sure we've got three days of future tables.
	for (my $i = 0; $i < 3; $i++)
	{
		my $day_offset     = $i * 86400;
		my $table_date     = strftime("%Y_%m_%d", gmtime(time + $day_offset));
		my $table_start    = strftime("%Y-%m-%d 00:00:00", gmtime(time + $day_offset));
		my $table_end      = strftime("%Y-%m-%d 00:00:00", gmtime(time + $day_offset + 86400));
		my $new_table_name = $table_name."_".$table_date;
		print "Checking if the table: [".$new_table_name."] exists yet... ";
		if (exists $conf->{tables}{$table_name}{existing_tables}{$new_table_name})
		{
			print "It exists.\n";
			delete $conf->{tables}{$table_name}{existing_tables}{$new_table_name};
		}
		else
		{
			print "It needs to be created! It will be used from: [".$table_start."] to: [".$table_end."]\n";
			push @{$conf->{database}{writes}}, "CREATE UNLOGGED TABLE IF NOT EXISTS ".$new_table_name." PARTITION OF ".$table_name." FOR VALUES FROM ('".$table_start."') TO ('".$table_end."')";
		}
	}
	
	# Now make sure we remove the table names for the number of days we want to keep so they don't get 
	# removed in the next step.
	for (my $i = 0; $i < $keep_days; $i++)
	{
		my $old_date       = strftime("%Y_%m_%d", gmtime(time - ($i * 86400)));
		my $old_table_name = $table_name."_".$old_date;
		if (exists $conf->{tables}{$table_name}{existing_tables}{$old_table_name})
		{
			print "The table: [".$old_table_name."] exists but is only: [".$i."] day(s) old, keeping it for now.\n";
			delete $conf->{tables}{$table_name}{existing_tables}{$old_table_name};
		}
	}

	# If there are any remaining entries in existing_tables, drop their tables.
	foreach my $old_table_name (sort {$a cmp $b} keys %{$conf->{tables}{$table_name}{existing_tables}})
	{
		# Obviously, don't delete the real table.
		next if $old_table_name eq $table_name;
		
		# Drop this table.
		print "Dropping the old table: [".$old_table_name."] to free space.\n";
		push @{$conf->{database}{writes}}, "DROP TABLE IF EXISTS ".$old_table_name.";";
		delete $conf->{tables}{$table_name}{existing_tables}{$old_table_name};
	}
}

# Commit writes.
my $count = @{$conf->{database}{writes}};
print "[ Debug ]:".__LINE__." - Query count: [".$count."]\n" if $conf->{debug};
if ($count)
{
	$conf->{database}{handle}->begin_work();
	foreach my $query (@{$conf->{database}{writes}})
	{
		db_write($query, 1);
	}
	$conf->{database}{handle}->commit();
}
else
{
	print "No tables need to be created or removed.\n";
}

print "Complete, exiting.\n";

$conf->{database}{handle}->disconnect();
exit(0);


#############################################################################################################
# Functions                                                                                                 #
#############################################################################################################

# This gets a list of all tables in the database with the name 'n2k_traffic*'.
sub get_existing_tables
{
	my ($table_name) = @_;
	
	local $@;
	my $search_name    = $table_name.'%';
	my $say_table_name = $conf->{database}{handle}->quote($search_name);
	my $query          = "SELECT table_name FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_name LIKE ".$say_table_name.";";
	print "[ Debug ]:".__LINE__." - query: [".$query."]\n" if $conf->{debug};
	my $DBreq = eval { $conf->{database}{handle}->prepare($query); };
	print "[ Debug ]:".__LINE__." - \$\@: [".$@."]\n" if $conf->{debug};
	if ($@)
	{
		# Failed.
		print "[ Error ] - The query: [".$query."] failed. Error: [".$conf->{database}{handle}->errstr."]\n";
		print "Exiting.\n";
		exit(1);
	}
	
	$DBreq->execute() or warn "[ Warning ] - Failed to execute: [".$query."], Error: [".$conf->{database}{handle}->errstr."]\n";
	my $results = $DBreq->fetchall_arrayref();
	   $results = [] if not defined $results;
	my $count   = ref($results) eq "ARRAY" ? @{$results} : 0;
	print "[ Debug ]:".__LINE__." - rows: [".$results."], count: [".$count."]\n" if $conf->{debug};
	
	if ($count)
	{
		foreach my $row (@{$results})
		{
			my $match_table_name = $row->[0];
			$conf->{tables}{$table_name}{existing_tables}{$match_table_name} = 1;
			print "[ Debug ]:".__LINE__." - existing_tables: [".$match_table_name."]: [".$conf->{tables}{$table_name}{existing_tables}{$match_table_name}."]\n" if $conf->{debug};
		}
	}
	
	return(0);
}

# This will hold until the connection is established.
sub db_connect
{
	my $connect_string = "DBI:Pg:dbname=".$conf->{database}{name}.";host=".$conf->{database}{host}.";port=".$conf->{database}{port};
	while (not $conf->{database}{handle})
	{
		local $@;
		my $test = eval { $conf->{database}{handle} = DBI->connect($connect_string, $conf->{database}{user}, $conf->{database}{password}, {
			RaiseError     => 1,
			AutoCommit     => 1,
			pg_enable_utf8 => 1,
		}); };
		$test = "" if not defined $test;
		print "[ Debug ]:".__LINE__." - test: [".$test."]\n" if $conf->{debug};
		if (not $test)
		{
			# Failed to connect.
			print "
[ Error ] - Failed to connect to the database!
[ Error ] - Connection string: [".$connect_string."]
[ Error ] - Database user: [".$conf->{database}{user}."], password supressed.
[ Error ] - Connection error:
====
".$@."
====
[ Note  ] - Will try to reconnect in ten seconds.
";
			sleep 10;
		}
	}
	print "[ Debug ]:".__LINE__." - Database handle: [".$conf->{database}{handle}."]\n" if $conf->{debug};

	return(0);
}

# Do a safe write.
sub db_write
{
	my ($query, $rollback) = @_;

	print "[ Debug ]:".__LINE__." - query: [".$query."]\n" if $conf->{debug};
	my $test = eval { $conf->{database}{handle}->do($query) or die "[ Error ] - The query: [".$query."] failed with: [".$conf->{database}{handle}->errstr."]\n"; };
	   $test = "" if not defined $test;
	print "[ Debug ]:".__LINE__." - test: [".$test."]\n" if $conf->{debug};

	if (not $test)
	{
		print "[ Error ] - Failed to do: [".$query."], the error was: [".$@."]\n";
		if ($rollback)
		{
			print "[ Error ] - Rolling back in-progress commits.\n";
			$conf->{database}{handle}->rollback();
		}
		print "Exiting\n";
		exit(1);
	}

	return(0);
}

exit(0);

